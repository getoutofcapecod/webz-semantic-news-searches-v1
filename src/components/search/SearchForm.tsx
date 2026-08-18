"use client";

import { useState, type FormEvent } from "react";

import { ChevronDownIcon } from "@/components/icons";
import {
  CATEGORIES,
  COUNTRIES,
  LANGUAGES,
  PRESET_TOPICS,
  QUERY_MAX_CHARS,
  RESULT_COUNT_OPTIONS,
} from "@/lib/constants";
import { SENTIMENTS } from "@/lib/types";
import type { SearchFilters, Sentiment } from "@/lib/types";

// Built once at module scope: the source lists are static, so rebuilding these
// on every keystroke would be pure waste.
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.label }));
const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c }));
const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l }));
const SENTIMENT_OPTIONS = SENTIMENTS.map((v) => ({
  value: v,
  label: `${v[0].toUpperCase()}${v.slice(1)}`,
}));

interface SearchFormProps {
  query: string;
  filters: SearchFilters;
  k: number;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onFiltersChange: (filters: SearchFilters) => void;
  onKChange: (value: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPreset: (preset: (typeof PRESET_TOPICS)[number]) => void;
}

/** Shared field styling so every control looks identical (fixed height, size per control). */
const FIELD_CLASS =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-orange-900";

/** Single-value `<select>` bound to one field of the `SearchFilters` object. */
function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_CLASS} text-sm`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchForm({
  query,
  filters,
  k,
  loading,
  onQueryChange,
  onFiltersChange,
  onKChange,
  onSubmit,
  onPreset,
}: SearchFormProps) {
  const [showFilters, setShowFilters] = useState(false);
  const setFilter = (patch: Partial<SearchFilters>) =>
    onFiltersChange({ ...filters, ...patch });

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Semantic query
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder='e.g. "central bank interest rate decisions"'
              maxLength={QUERY_MAX_CHARS}
              className={`${FIELD_CLASS} text-base`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Results
            </span>
            <select
              value={k}
              onChange={(e) => onKChange(Number(e.target.value))}
              className={`${FIELD_CLASS} text-sm`}
            >
              {RESULT_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || query.trim().length === 0}
              className="h-10 w-full rounded-lg bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900 sm:w-auto"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={showFilters}
            className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-zinc-600 transition hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-300 dark:hover:text-orange-400 dark:focus-visible:ring-offset-zinc-950"
          >
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
            Advanced filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-800 lg:grid-cols-4">
            <FilterSelect
              label="Country"
              value={filters.country?.[0] ?? ""}
              options={COUNTRY_OPTIONS}
              placeholder="Any country"
              onChange={(v) => setFilter(v ? { country: [v] } : { country: undefined })}
            />
            <FilterSelect
              label="Category"
              value={filters.category?.[0] ?? ""}
              options={CATEGORY_OPTIONS}
              placeholder="Any category"
              onChange={(v) =>
                setFilter(v ? { category: [v] } : { category: undefined })
              }
            />
            <FilterSelect
              label="Language"
              value={filters.language?.[0] ?? ""}
              options={LANGUAGE_OPTIONS}
              placeholder="Any language"
              onChange={(v) =>
                setFilter(v ? { language: [v] } : { language: undefined })
              }
            />
            <FilterSelect
              label="Sentiment"
              value={filters.sentiment?.[0] ?? ""}
              options={SENTIMENT_OPTIONS}
              placeholder="Any sentiment"
              onChange={(v) =>
                setFilter(
                  v
                    ? { sentiment: [v as Sentiment] }
                    : { sentiment: undefined },
                )
              }
            />
          </div>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Try a topic
        </span>
        {PRESET_TOPICS.map((topic) => (
          <button
            key={topic.label}
            type="button"
            onClick={() => onPreset(topic)}
            disabled={loading}
            className="whitespace-normal rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-left text-xs font-medium leading-snug text-zinc-700 transition hover:border-orange-400 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-orange-500 dark:hover:text-orange-400 dark:focus-visible:ring-offset-zinc-950"
          >
            {topic.label}
            {topic.sentiment ? (
              <span className="ml-1 font-normal normal-case text-zinc-400 dark:text-zinc-500">
                · {topic.sentiment} sentiment
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
