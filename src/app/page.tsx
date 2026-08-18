import type { Metadata } from "next";

import { SearchApp } from "@/components/search/SearchApp";

export const metadata: Metadata = {
  title: "Semantic News Searches | Webz.io News Search API",
  description:
    "A small Next.js demo of the Webz.io News Search API: natural-language semantic search over global news with sentiment, country, category, and language filters.",
};

export default function HomePage() {
  return (
    <main className="flex-1">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-widest text-orange-600 dark:text-orange-400">
            Semantic News Searches
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Find the signal in the news
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Ask a question in plain language. This demo uses Webz.io&apos;s
            semantic News Search to find articles <em>by meaning</em>, not just
            keywords, then filters by sentiment, country, category, and language.
          </p>
        </div>
      </header>

      <SearchApp />
    </main>
  );
}
