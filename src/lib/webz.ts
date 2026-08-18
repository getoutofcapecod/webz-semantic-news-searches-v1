/**
 * Server-only client for the Webz.io News Search API.
 *
 * This module talks to `POST https://api.webz.io/api/news/context` and maps the
 * raw JSON into the clean, typed shapes in `lib/types.ts`.
 *
 * SECURITY: this file imports `server-only`, so Next.js will refuse to bundle
 * it into any Client Component. The API token lives in an environment variable
 * (`WEBZ_API_TOKEN`) and is read here on the server only. It never reaches the
 * browser. Client Components import types from `lib/types.ts` and talk to the
 * Route Handler in `app/api/search/route.ts`, never to this module.
 */
import "server-only";

import {
  MAX_RESULTS,
  QUERY_MAX_CHARS,
  QUERY_MAX_WORDS,
} from "./constants";
import { SENTIMENTS } from "./types";
import type {
  SearchFilters,
  SearchParams,
  SearchResponse,
  SearchResult,
  Sentiment,
} from "./types";

const WEBZ_API_BASE = "https://api.webz.io";
const NEWS_CONTEXT_ENDPOINT = "/api/news/context";

/**
 * Hard ceiling on how long we wait for Webz.io. Without this, a stalled
 * upstream call keeps the Route Handler and its socket alive indefinitely.
 * The browser gives up after its own timeout, but the server would not.
 */
const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Webz.io documents 5xx as "temporary server error; retry later" and states
 * that failed requests are not charged, so a single retry is free and often
 * turns a user-visible error into a normal result.
 */
const UPSTREAM_MAX_ATTEMPTS = 2;
const UPSTREAM_RETRY_DELAY_MS = 400;

/**
 * Identical searches are answered from a short-lived cache instead of being
 * billed twice. The News Search API charges per call, so a double-click or a
 * re-picked preset would otherwise burn credits for a result we already have.
 * The TTL is deliberately short: news is the point, and Webz.io's own crawl
 * latency is far longer than this window.
 */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 50;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isSentiment(value: unknown): value is Sentiment {
  return (
    typeof value === "string" &&
    (SENTIMENTS as readonly string[]).includes(value)
  );
}

/** Error thrown for any Webz.io API problem, carrying the HTTP status. */
export class WebzApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WebzApiError";
  }
}

function getToken(): string {
  const token = process.env.WEBZ_API_TOKEN;
  if (!token) {
    throw new WebzApiError(
      0,
      "WEBZ_API_TOKEN is not configured. Copy .env.example to .env.local and add a token from https://app.webz.io (free tier includes monthly credits).",
    );
  }
  return token;
}

function assertValidQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new WebzApiError(400, "Query must not be empty.");
  }
  if (trimmed.length > QUERY_MAX_CHARS) {
    throw new WebzApiError(
      400,
      `Query must be at most ${QUERY_MAX_CHARS} characters (got ${trimmed.length}).`,
    );
  }
  const words = trimmed.split(/\s+/).length;
  if (words > QUERY_MAX_WORDS) {
    throw new WebzApiError(
      400,
      `Query must be at most ${QUERY_MAX_WORDS} words (got ${words}).`,
    );
  }
  return trimmed;
}

/** Drop empty/unknown filter values before they reach the wire. */
function sanitizeFilters(filters: SearchFilters): SearchFilters | undefined {
  const clean: SearchFilters = {};
  if (filters.language?.length) clean.language = filters.language;
  if (filters.country?.length) clean.country = filters.country;
  if (filters.category?.length) clean.category = filters.category;
  if (filters.sentiment?.length) {
    const valid = filters.sentiment.filter(isSentiment);
    if (valid.length) clean.sentiment = valid;
  }
  if (filters.publishedFrom && ISO_DATE.test(filters.publishedFrom)) {
    clean.publishedFrom = filters.publishedFrom;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

interface CacheEntry {
  expires: number;
  promise: Promise<SearchResponse>;
}

/**
 * Keyed by the exact upstream request. Storing the *promise* (not the resolved
 * value) means concurrent identical searches share a single billed call
 * instead of racing each other. This handles the common case when a user double-clicks
 * Search or hammers the preset buttons.
 */
const searchCache = new Map<string, CacheEntry>();

/** Stable cache key: arrays are sorted so filter order never splits the cache. */
function cacheKey(query: string, k: number, filters?: SearchFilters): string {
  const normalized = filters
    ? {
        language: filters.language ? [...filters.language].sort() : undefined,
        country: filters.country ? [...filters.country].sort() : undefined,
        category: filters.category ? [...filters.category].sort() : undefined,
        sentiment: filters.sentiment ? [...filters.sentiment].sort() : undefined,
        publishedFrom: filters.publishedFrom,
      }
    : undefined;
  return JSON.stringify({ query, k, filters: normalized });
}

function readCache(key: string): Promise<SearchResponse> | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return entry.promise;
}

function writeCache(key: string, promise: Promise<SearchResponse>): void {
  const now = Date.now();
  for (const [existingKey, entry] of searchCache) {
    if (entry.expires <= now) searchCache.delete(existingKey);
  }
  // Bound the map so a long-running server cannot accumulate entries forever.
  while (searchCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = searchCache.keys().next();
    if (oldest.done) break;
    searchCache.delete(oldest.value);
  }
  searchCache.set(key, { expires: now + CACHE_TTL_MS, promise });
}

/**
 * Resolve `promise`, but give up early if `signal` aborts.
 *
 * The shared upstream call is deliberately *not* aborted here: the credit is
 * spent the moment Webz.io accepts the request, so letting it finish keeps the
 * result available in the cache for the next caller. This only stops *this*
 * caller from waiting.
 */
function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new WebzApiError(499, "Search was cancelled."));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(new WebzApiError(499, "Search was cancelled."));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

/**
 * Run a News Search query against Webz.io.
 *
 * Throws `WebzApiError` on any problem (bad input, missing token, upstream
 * error). Identical searches inside `CACHE_TTL_MS` reuse one billed call; the
 * underlying fetch still uses `cache: "no-store"` so Next.js never serves a
 * stale response of its own on top of ours.
 */
export async function searchNews(
  params: SearchParams,
  options: { signal?: AbortSignal } = {},
): Promise<SearchResponse> {
  const query = assertValidQuery(params.query);
  const filters = params.filters ? sanitizeFilters(params.filters) : undefined;
  const k = Math.min(Math.max(1, Math.round(params.k ?? 10)), MAX_RESULTS);

  const key = cacheKey(query, k, filters);
  const cached = readCache(key);
  if (cached) return withSignal(cached, options.signal);

  // getToken() throws before anything is cached, so a misconfigured server
  // keeps reporting the config error rather than caching a failure.
  const token = getToken();

  const request = requestSearch(token, query, k, filters);
  writeCache(key, request);
  // A failed call must not be cached: drop the entry so the next attempt retries.
  request.catch(() => {
    if (searchCache.get(key)?.promise === request) searchCache.delete(key);
  });

  return withSignal(request, options.signal);
}

async function requestSearch(
  token: string,
  query: string,
  k: number,
  filters?: SearchFilters,
): Promise<SearchResponse> {
  const body = JSON.stringify({
    query,
    k,
    ...(filters ? { filters: wireFilters(filters) } : {}),
  });

  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${WEBZ_API_BASE}${NEWS_CONTEXT_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      // Not retried: a retry would double an already long wait for the user.
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new WebzApiError(
          504,
          `Webz.io did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s. Please try again.`,
        );
      }
      throw new WebzApiError(
        502,
        "Could not reach Webz.io. Check the server's network connection.",
      );
    }

    if (response.ok) {
      return parseResponse(await response.json());
    }

    // Webz.io documents 5xx as temporary and does not charge failed requests,
    // so one quick retry costs nothing but recovers the common blip. Every
    // other status (401/402/403/422/429) is deterministic. Retrying it would
    // just spend another second confirming the same answer.
    if (response.status >= 500 && attempt < UPSTREAM_MAX_ATTEMPTS) {
      await sleep(UPSTREAM_RETRY_DELAY_MS * attempt);
      continue;
    }

    throw await toApiError(response);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Convert our filter shape into the field names Webz.io expects. */
function wireFilters(filters: SearchFilters): Record<string, unknown> {
  return {
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.sentiment ? { sentiment: filters.sentiment } : {}),
    ...(filters.publishedFrom ? { published_from: filters.publishedFrom } : {}),
  };
}

async function toApiError(response: Response): Promise<WebzApiError> {
  let detail: string | undefined;
  try {
    const body = (await response.json()) as { detail?: string; error?: string };
    detail = body.detail ?? body.error;
  } catch {
    /* non-JSON body; fall through to a generic message */
  }

  let message = detail ?? `Webz.io returned HTTP ${response.status}.`;
  const friendly = friendlyMessage(response.status);
  if (friendly) message = `${friendly} (${message})`;

  return new WebzApiError(response.status, message);
}

/**
 * Map an upstream status onto a message a demo user can act on.
 *
 * These are the News Search API's documented statuses. Note they differ from
 * the News API's: here insufficient credits is 402 and 429 means *only* that
 * the token exceeded its request rate, so the two get different advice.
 */
function friendlyMessage(status: number): string | null {
  if (status >= 500) {
    return "Webz.io reported a temporary server error. Please try again shortly.";
  }

  switch (status) {
    case 400:
      return "Webz.io rejected the query (it must be at most 750 characters and 100 words).";
    case 401:
      return "Authentication failed. Check that WEBZ_API_TOKEN is valid and that your account has the `api_news` permission.";
    case 402:
      return "Your Webz.io account has insufficient credits. Free-tier credits reset monthly.";
    case 403:
      return "Your Webz.io account is inactive, blocked, or its trial has ended.";
    case 422:
      return "Webz.io rejected the request body (for example, a result count above 50).";
    case 429:
      return "Rate limit exceeded for this token. Webz.io meters requests per second; wait a moment and retry.";
    default:
      return null;
  }
}

/** Defensive parser: tolerate a slightly off-schema response without crashing. */
function parseResponse(raw: unknown): SearchResponse {
  const data = (raw ?? {}) as Record<string, unknown>;

  const rawResults = Array.isArray(data.results) ? data.results : [];
  const results: SearchResult[] = rawResults
    .map(parseResult)
    .filter((r): r is SearchResult => r !== null);

  return {
    query: typeof data.query === "string" ? data.query : "",
    totalResults:
      typeof data.total_results === "number" ? data.total_results : results.length,
    results,
    requestsLeft: typeof data.requests_left === "number" ? data.requests_left : -1,
    creditsUsed: typeof data.credits_used === "number" ? data.credits_used : -1,
  };
}

function parseResult(raw: unknown): SearchResult | null {
  const entry = (raw ?? {}) as {
    article?: Record<string, unknown>;
    chunk?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  if (!entry.article) return null;

  const article = entry.article;
  const chunk = entry.chunk ?? {};
  const metadata = entry.metadata ?? {};

  return {
    article: {
      id: stringOf(article.article_id),
      url: stringOf(article.url),
      title: stringOf(article.title) || "Untitled",
      publishedAt: stringOf(article.published_at),
      summary: stringOf(article.summary),
    },
    chunk: {
      id: stringOf(chunk.chunk_id),
      index: typeof chunk.chunk_index === "number" ? chunk.chunk_index : 0,
      text: stringOf(chunk.text),
    },
    metadata: {
      language: stringOf(metadata.language),
      country: stringOf(metadata.country),
      category: Array.isArray(metadata.category)
        ? metadata.category.filter((c): c is string => typeof c === "string")
        : [],
      sentiment: isSentiment(metadata.sentiment) ? metadata.sentiment : null,
      domain: stringOf(metadata.domain),
      siteType: stringOf(metadata.site_type),
    },
  };
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}
