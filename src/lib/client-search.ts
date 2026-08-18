/**
 * Client-side helper for running a search from the browser.
 *
 * It posts to our own Route Handler (`/api/search`), which is the only piece
 * that talks to Webz.io, so the API token never leaves the server.
 */
import type { SearchParams, SearchResponse } from "./types";

/** Give up on a hung request so the UI can recover instead of spinning forever. */
const REQUEST_TIMEOUT_MS = 15_000;

export class SearchRequestError extends Error {
  /** HTTP status from `/api/search`, or 0 when the request never got a reply. */
  readonly status: number;
  /**
   * The caller abandoned this search. A newer one superseded it, or the
   * component unmounted. Not a failure, and must not be rendered as one.
   */
  readonly cancelled: boolean;

  constructor(message: string, status: number, cancelled = false) {
    super(message);
    this.name = "SearchRequestError";
    this.status = status;
    this.cancelled = cancelled;
  }

  static cancel(): SearchRequestError {
    return new SearchRequestError("Search cancelled.", 0, true);
  }
}

export async function runClientSearch(
  params: SearchParams,
  options: { signal?: AbortSignal } = {},
): Promise<SearchResponse> {
  const { signal: externalSignal } = options;
  if (externalSignal?.aborted) throw SearchRequestError.cancel();

  // One controller drives both the timeout and the caller's cancellation, so a
  // superseded search stops in flight instead of racing the one that replaced
  // it. (`AbortSignal.any` would be neater but is too new to rely on here.)
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", forwardAbort, { once: true });

  let response: Response;
  try {
    response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
  } catch {
    if (timedOut) {
      throw new SearchRequestError("Search timed out. Please try again.", 0);
    }
    if (externalSignal?.aborted) throw SearchRequestError.cancel();
    throw new SearchRequestError(
      "Network error. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }

  if (!response.ok) {
    let message = "Search failed.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep the generic message */
    }
    throw new SearchRequestError(message, response.status);
  }

  return (await response.json()) as SearchResponse;
}
