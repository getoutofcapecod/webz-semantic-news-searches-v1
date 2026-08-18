/**
 * Shared types for the Webz.io News Search demo, plus the one literal tuple
 * the sentiment union is derived from.
 *
 * These types are intentionally framework- and runtime-agnostic and carry no
 * side effects, so both Server Components / Route Handlers and Client
 * Components can import them freely. Do NOT add `import "server-only"` here.
 * The server-only boundary belongs in the API client module (`lib/webz.ts`).
 */

/**
 * The sentiment values the API accepts as a filter and returns on a result.
 * The union is derived from the tuple so validators, zod enums, and the type
 * can never drift apart.
 */
export const SENTIMENTS = ["positive", "negative", "neutral"] as const;

export type Sentiment = (typeof SENTIMENTS)[number];

/** Filters accepted by the Webz.io News Search API. Every field is optional. */
export interface SearchFilters {
  language?: string[];
  country?: string[];
  category?: string[];
  sentiment?: Sentiment[];
  /** ISO date `YYYY-MM-DD`; restrict results to articles published on/after this date. */
  publishedFrom?: string;
}

/** A search request as understood by the demo UI and the API client. */
export interface SearchParams {
  query: string;
  /** Maximum number of articles to return (Webz.io caps this at 50). */
  k?: number;
  filters?: SearchFilters;
}

/** The article-level metadata returned for a match. */
export interface NewsArticle {
  id: string;
  url: string;
  title: string;
  publishedAt: string;
  summary: string;
}

/** The most relevant passage within the article, plus its context. */
export interface ResultChunk {
  id: string;
  index: number;
  text: string;
}

/** Per-result enrichment returned alongside the article and chunk. */
export interface ResultMetadata {
  language: string;
  country: string;
  category: string[];
  sentiment: Sentiment | null;
  domain: string;
  siteType: string;
}

/** A single search result, normalised into the shape the UI renders. */
export interface SearchResult {
  article: NewsArticle;
  chunk: ResultChunk;
  metadata: ResultMetadata;
}

/** The response the UI consumes for each search. */
export interface SearchResponse {
  query: string;
  totalResults: number;
  results: SearchResult[];
  requestsLeft: number;
  creditsUsed: number;
}
