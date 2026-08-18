/**
 * POST /api/search
 *
 * The single server-side entry point for interactive searches from the
 * browser. It validates the request body with zod, delegates to the Webz.io
 * client, and returns a clean JSON payload without exposing the API token.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { searchNews, WebzApiError } from "@/lib/webz";
import {
  CATEGORIES,
  MAX_RESULTS,
  QUERY_MAX_CHARS,
  QUERY_MAX_WORDS,
} from "@/lib/constants";
import { SENTIMENTS } from "@/lib/types";

const filtersSchema = z
  .object({
    language: z.array(z.string().min(1).max(40)).max(20).optional(),
    country: z.array(z.string().min(2).max(2)).max(20).optional(),
    category: z.array(z.enum(CATEGORIES)).max(20).optional(),
    sentiment: z.array(z.enum(SENTIMENTS)).max(SENTIMENTS.length).optional(),
    publishedFrom: z
      .iso
      .date({ message: "publishedFrom must be an ISO date (YYYY-MM-DD)" })
      .optional(),
  })
  .optional();

const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Query must not be empty.")
    .max(QUERY_MAX_CHARS, `Query must be at most ${QUERY_MAX_CHARS} characters.`)
    .refine(
      (q) => q.split(/\s+/).filter(Boolean).length <= QUERY_MAX_WORDS,
      `Query must be at most ${QUERY_MAX_WORDS} words.`,
    ),
  k: z.number().int().min(1).max(MAX_RESULTS).optional(),
  filters: filtersSchema,
});

const RATE_LIMIT = 20; // max requests
const RATE_WINDOW_MS = 60_000; // per minute, per client IP
/** Sweep stale buckets once the map grows past this, so it cannot leak. */
const RATE_SWEEP_THRESHOLD = 1_000;
const requestLog = new Map<string, number[]>();

/**
 * Drop buckets whose hits have all aged out. Without this the map keeps one
 * entry per IP that ever called, forever: entries were only ever pruned when
 * that same IP came back, so a public deployment would grow unboundedly.
 */
function sweepExpired(windowStart: number): void {
  for (const [key, hits] of requestLog) {
    const live = hits.filter((t) => t > windowStart);
    if (live.length === 0) requestLog.delete(key);
    else requestLog.set(key, live);
  }
}

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  if (requestLog.size > RATE_SWEEP_THRESHOLD) sweepExpired(windowStart);

  const hits = (requestLog.get(ip) ?? []).filter((t) => t > windowStart);
  if (hits.length >= RATE_LIMIT) {
    requestLog.set(ip, hits);
    return false;
  }
  hits.push(now);
  requestLog.set(ip, hits);
  return true;
}

/** Best-effort client identity for the demo limiter, behind a proxy or not. */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  // Cheap demo guard against credit exhaustion: cap requests per client IP.
  // In-memory and best-effort only (per server instance); a public deployment
  // would use a managed limiter. Documented as a demo-level protection.
  if (!allowRequest(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    // If the browser gives up (navigation, timeout, a superseded search),
    // stop awaiting the upstream call instead of holding this handler open.
    const data = await searchNews(parsed.data, { signal: request.signal });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof WebzApiError) {
      // 499: the client hung up. Nothing is waiting for this body.
      if (error.status === 499) {
        return new NextResponse(null, { status: 499 });
      }
      // A status of 0 means a local/config error (e.g. missing token).
      return NextResponse.json(
        { error: error.message },
        { status: error.status === 0 ? 500 : error.status },
      );
    }
    console.error("Unexpected error in /api/search:", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
