# Semantic News Searches

A Next.js demo for the [Webz.io News Search API](https://docs.webz.io/docs/webz/news-search),
meant as a reference for developers evaluating or integrating the API. You type a
question in plain language, get back articles matched by meaning rather than keyword,
and can filter by sentiment, country, category, and language.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your WEBZ_API_TOKEN
npm run dev                  # http://localhost:3000
```

Get a token from [app.webz.io](https://app.webz.io). News Search shares the
token and `api_news` permission with the News API. It is billed per call; the free
plan's $5/month is plenty. The UI shows `credits_used` and `requests_left`
under the result count so you can keep an eye on spend.

Without a token the app still boots, it just tells you to add one.

## The API call

The app makes one request per search:

```bash
curl -X POST "https://api.webz.io/api/news/context" \
  -H "Authorization: Bearer $WEBZ_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "central bank interest rate decisions",
    "k": 10,
    "filters": { "language": ["english"], "country": ["US", "GB"] }
  }'
```

`query` is capped at 750 characters and 100 words, and `k` (result count)
defaults to 10 with a max of 50. Each result pairs the article with the
passage that matched:

```jsonc
{
  "query": "central bank interest rate decisions",
  "total_results": 1,
  "results": [
    {
      "article": {
        "article_id": "a83e94d1…",
        "url": "https://example.com/article",
        "title": "Example article",
        "published_at": "2026-08-05T14:30:00Z",
        "summary": "Article summary"
      },
      "chunk": { "chunk_id": "…", "chunk_index": 0, "text": "The matching passage." },
      "metadata": {
        "language": "english", "country": "US", "category": ["business"],
        "sentiment": "neutral", "domain": "example.com", "site_type": "news"
      }
    }
  ],
  "requests_left": 998,
  "credits_used": 1
}
```

`lib/webz.ts` normalises that into the camelCase shapes in `lib/types.ts`.

To test against the app's own endpoint instead of Webz.io directly:

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"renewable energy investments in Germany","k":10}'
```

## Architecture

```
Browser (Client Component)                 Server
┌──────────────────────────┐      ┌─────────────────────────────────────┐
│ SearchApp  ──POST /api/search──▶│ Route Handler (zod validation)       │
│   (state, results, errors)      │   └─▶ lib/webz.ts  (server-only)     │
│   │                             │         └─▶ POST api.webz.io/api/    │
│   └──── JSON results ───────────┘                 news/context         │
└──────────────────────────┘      └─────────────────────────────────────┘
```

The page is a static shell and no query runs on mount, so opening it doesn't
cost a credit. When you search, the browser posts to `/api/search`, which
validates the body with zod and hands off to `lib/webz.ts`. That module
imports `server-only` so the token can't end up in a client bundle. The
browser never talks to Webz.io directly.

## Keeping costs down

The API bills per call, so the app avoids wasting them. No query runs on page
load, and query length limits are checked client-side before the request goes
out (the API rejects them anyway, but there's no reason to burn the round trip).

Identical searches are coalesced and cached for 60 seconds. If someone
double-clicks or re-picks a preset, it reuses the same billed call. It also
concurrent duplicates share one in-flight request rather than racing. When a new
search comes in, it aborts the previous one, which also prevents a slow response
from overwriting fresher results.

Only 5xx errors are retried (once). Failed requests aren't charged and Webz.io
documents 5xx as temporary, so the retry is free. Everything else is
deterministic and surfaces immediately. There's a 15-second timeout on the
upstream call so a stalled request can't hold a route handler open indefinitely,
and a basic per-IP rate limit on `/api/search` to keep a runaway script from
draining the account (in-memory and per-instance; not production-grade, but good
enough for a demo).

Only successful responses go in the cache, so failures always retry for real.

## Errors

| Status | What it means |
| --- | --- |
| 400 | Query too long (>750 chars or >100 words) |
| 401 | Bad token or missing `api_news` permission |
| 402 | Out of credits |
| 403 | Account inactive or blocked |
| 422 | Bad request body (e.g. `k` > 50) |
| 429 | Rate-limited |
| 5xx | Temporary upstream error (retried once, then surfaced) |

If you also use the News API, note that the two products use these codes
differently. On News Search, credit exhaustion is a **402** and **429** only
means rate limiting. On the News API, 429 covers both.

## Good to know

If you don't set a `language` filter and the query is longer than two words, the
API may auto-detect the language and filter on it. An explicit filter overrides
this.

Results include the matching passage (`chunk.text`), not the full article. If you
need the whole document, pass `article.article_id` to the News API as
`q=uuid:<id>` with `ts` set to 30 days ago. This app just shows the excerpt.

Coverage goes back 30 days. The `published_from` filter narrows it further.

## Project layout

```
src/
├── app/
│   ├── api/search/route.ts   # POST endpoint: validate → call API → JSON
│   ├── layout.tsx            # root layout + metadata
│   ├── page.tsx              # static shell, no query on open
│   └── error.tsx             # client error boundary
├── components/search/
│   ├── SearchApp.tsx         # client container: state + search orchestration
│   ├── SearchForm.tsx        # query input, filters, result count, presets
│   ├── ResultCard.tsx        # single result
│   ├── ResultSkeleton.tsx    # loading placeholder
│   └── StatusPanel.tsx       # hint / empty / error states
└── lib/
    ├── constants.ts          # API limits, filter options, preset topics
    ├── types.ts              # shared types (safe to import from client code)
    ├── webz.ts               # server-only Webz.io client
    └── client-search.ts      # browser-side fetch wrapper for /api/search
```

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, zod.

## Out of scope

This is a demo, not a service. If you're going to production you'd want real
auth on `/api/search`, a shared rate limiter (not in-memory), observability,
and probably a persistence layer for results older than the API's 30-day window.

## License

MIT
