import { ExternalLinkIcon } from "@/components/icons";
import type { SearchResult, Sentiment } from "@/lib/types";

interface ResultCardProps {
  result: SearchResult;
}

const SENTIMENT_TEXT: Record<Sentiment, string> = {
  positive: "text-emerald-700 dark:text-emerald-300",
  neutral: "text-zinc-500 dark:text-zinc-400",
  negative: "text-rose-700 dark:text-rose-300",
};

const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ResultCard({ result }: ResultCardProps) {
  const { article, chunk, metadata } = result;
  const publishedLabel = formatDate(article.publishedAt);
  const sentiment = metadata.sentiment;

  return (
    <article className="py-5">
      <h3 className="break-words text-base font-medium leading-snug">
        {article.url ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-900 underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-100 dark:focus-visible:ring-offset-zinc-950"
          >
            {article.title}
            <ExternalLinkIcon className="ml-1 inline h-3.5 w-3.5 -translate-y-px text-zinc-500" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          article.title
        )}
      </h3>

      <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        {metadata.domain}
        <span aria-hidden="true"> · </span>
        <time dateTime={article.publishedAt || undefined}>{publishedLabel}</time>
        {sentiment && (
          <>
            <span aria-hidden="true"> · </span>
            <span className={`font-medium ${SENTIMENT_TEXT[sentiment]}`}>
              {SENTIMENT_LABELS[sentiment]}
            </span>
          </>
        )}
        {metadata.category.length > 0 && (
          <>
            <span aria-hidden="true"> · </span>
            <span>{metadata.category.join(", ")}</span>
          </>
        )}
      </p>

      {chunk.text?.trim() && (
        <p className="mt-3 break-words rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
          {chunk.text}
        </p>
      )}
    </article>
  );
}
