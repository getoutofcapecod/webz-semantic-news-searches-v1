"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { runClientSearch, SearchRequestError } from "@/lib/client-search";
import { DEFAULT_QUERY, DEFAULT_RESULT_COUNT } from "@/lib/constants";
import type { PRESET_TOPICS } from "@/lib/constants";
import type {
  SearchFilters,
  SearchResponse,
  SearchResult,
} from "@/lib/types";

import { ResultCard } from "./ResultCard";
import { ResultSkeleton } from "./ResultSkeleton";
import { SearchForm } from "./SearchForm";
import { StatusPanel } from "./StatusPanel";

interface SearchMeta {
  totalResults: number;
  requestsLeft: number;
  creditsUsed: number;
}

const EMPTY_META: SearchMeta = {
  totalResults: 0,
  requestsLeft: -1,
  creditsUsed: -1,
};

/**
 * "1 credit used · 998 left", omitting whichever figure the response did not
 * report rather than printing the -1 placeholder.
 */
function formatUsage({ creditsUsed, requestsLeft }: SearchMeta): string {
  const parts: string[] = [];
  if (creditsUsed >= 0) {
    parts.push(`${creditsUsed} credit${creditsUsed === 1 ? "" : "s"} used`);
  }
  if (requestsLeft >= 0) parts.push(`${requestsLeft} left`);
  return parts.join(" · ");
}

export function SearchApp() {
  // No query runs on mount. Results appear only after the user submits a search
  // or picks a preset, so opening the page never costs a credit.
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [k, setK] = useState(DEFAULT_RESULT_COUNT);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<SearchMeta>(EMPTY_META);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Tracks the in-flight search so a newer one can cancel it. Without this, a
  // slow earlier response could land after a fast later one and overwrite the
  // results the user is actually looking at.
  const inFlight = useRef<AbortController | null>(null);

  // Abort on unmount so a pending request cannot call setState afterwards.
  useEffect(() => () => inFlight.current?.abort(), []);

  const runSearch = async (overrides?: {
    query?: string;
    filters?: SearchFilters;
    k?: number;
  }) => {
    const q = overrides?.query ?? query;
    const f = overrides?.filters ?? filters;
    const count = overrides?.k ?? k;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data: SearchResponse = await runClientSearch(
        { query: q, k: count, filters: f },
        { signal: controller.signal },
      );
      setResults(data.results);
      setMeta({
        totalResults: data.totalResults,
        requestsLeft: data.requestsLeft,
        creditsUsed: data.creditsUsed,
      });
      // Reflect the executed params back into the form so the UI stays in sync.
      setQuery(q);
      setFilters(f);
      setK(count);
      setHasSearched(true);
    } catch (err) {
      // A superseded search is not a failure: the search that replaced it
      // owns the UI now, so leave its spinner and results alone.
      if (err instanceof SearchRequestError && err.cancelled) return;
      setError(
        err instanceof Error ? err.message : "Search failed. Please try again.",
      );
    } finally {
      // Only the newest search may clear the spinner.
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  };

  const handlePreset = (preset: (typeof PRESET_TOPICS)[number]) => {
    // A preset carries its own query and optional sentiment filter; start clean.
    const presetFilters: SearchFilters = preset.sentiment
      ? { sentiment: [preset.sentiment] }
      : {};
    setQuery(preset.query);
    setFilters(presetFilters);
    void runSearch({ query: preset.query, filters: presetFilters });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch();
  };

  const usage = formatUsage(meta);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <SearchForm
        query={query}
        filters={filters}
        k={k}
        loading={loading}
        onQueryChange={setQuery}
        onFiltersChange={setFilters}
        onKChange={setK}
        onSubmit={handleSubmit}
        onPreset={handlePreset}
      />

      <section aria-live="polite" className="mt-8">
        {loading ? (
          <ResultSkeleton count={Math.min(k, 5)} />
        ) : error ? (
          <StatusPanel variant="error" message={error} />
        ) : !hasSearched ? (
          <StatusPanel
            variant="hint"
            message="Run a search to see results. Try a preset topic above or type your own query."
          />
        ) : results.length === 0 ? (
          <StatusPanel
            variant="empty"
            message={`No results for “${query}”. Try rewording the query or loosening the filters.`}
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span>
                <strong className="font-medium text-zinc-800 dark:text-zinc-100">
                  {results.length}
                </strong>{" "}
                of{" "}
                <strong className="font-medium text-zinc-800 dark:text-zinc-100">
                  {meta.totalResults}
                </strong>{" "}
                results for “{query}”
              </span>
              {usage && <span className="tabular-nums">{usage}</span>}
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {results.map((result, index) => (
                <li key={result.article.id || `${index}-${result.article.url}`}>
                  <ResultCard result={result} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
