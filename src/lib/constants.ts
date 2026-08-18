/**
 * Shared static data: the API's documented limits, filter options, and preset
 * search topics. Values only, no side effects, so both Client and Server code
 * can import it.
 */
import type { Sentiment } from "./types";

/**
 * Limits documented by the News Search API. Defined once here so the zod
 * schema, the API client, and the input's `maxLength` cannot drift apart.
 */
export const QUERY_MAX_CHARS = 750;
export const QUERY_MAX_WORDS = 100;
export const MAX_RESULTS = 50;

/** The 17 IPTC topic categories accepted by the News Search API filters. */
export const CATEGORIES = [
  "Arts, Culture and Entertainment",
  "Crime, Law and Justice",
  "Disaster and Accident",
  "Economy, Business and Finance",
  "Education",
  "Environment",
  "Health",
  "Human Interest",
  "Labor",
  "Lifestyle and Leisure",
  "Politics",
  "Religion and Belief",
  "Science and Technology",
  "Social Issue",
  "Sport",
  "War, Conflict and Unrest",
  "Weather",
] as const;

/** Country filter options (ISO 3166-1 alpha-2 codes, as accepted by the API). */
export const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "IT", label: "Italy" },
  { code: "ES", label: "Spain" },
  { code: "JP", label: "Japan" },
  { code: "IN", label: "India" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "SG", label: "Singapore" },
  { code: "AE", label: "United Arab Emirates" },
] as const;

/** Language filter options (value is what the API expects, a lowercase name). */
export const LANGUAGES = [
  "english",
  "spanish",
  "french",
  "german",
  "italian",
  "portuguese",
  "dutch",
  "russian",
  "arabic",
  "chinese",
  "japanese",
  "korean",
  "hindi",
  "turkish",
] as const;

/**
 * Preset semantic-search topics. Each label is the exact query string entered
 * into the search box, phrased as the natural-language topic the API is meant
 * to match by meaning. The two sentiment examples also apply a `filters`
 * sentiment so the UI demonstrates that documented feature too.
 */
export const PRESET_TOPICS: ReadonlyArray<{
  label: string;
  query: string;
  sentiment?: Sentiment;
}> = [
  {
    label: "renewable energy investments in Germany",
    query: "renewable energy investments in Germany",
  },
  {
    label: "federal reserve interest rate decisions",
    query: "federal reserve interest rate decisions",
  },
  {
    label: "artificial intelligence regulation in the European Union",
    query: "artificial intelligence regulation in the European Union",
  },
  {
    label: "climate policy progress and emissions reductions",
    query: "climate policy progress and emissions reductions",
    sentiment: "positive",
  },
  {
    label: "tech layoffs and hiring freezes",
    query: "tech layoffs and hiring freezes",
    sentiment: "negative",
  },
];

/** Initial query shown in the search box before the user searches. */
export const DEFAULT_QUERY = "renewable energy investments in Germany";

/** Default result count returned per search. */
export const DEFAULT_RESULT_COUNT = 10;

/** Result-count options offered in the UI. */
export const RESULT_COUNT_OPTIONS = [5, 10, 20, MAX_RESULTS] as const;
