<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev`. Verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions

- **Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Tailwind CSS v4, zod.
- **Server Components are the default.** Only add `"use client"` to the interactive
  leaves (`src/components/search/*`). Do not add hooks to a file without the directive.
- **Never import `lib/webz.ts` from a client component.** It imports `server-only`;
  the API token must stay server-side. Client code imports types from `lib/types.ts`
  and talks to the app via `/api/search`.
- **Searches are reads, not mutations.** New server endpoints go in `app/api/`
  as Route Handlers, not server actions (server actions are for mutations).
- **The token is `WEBZ_API_TOKEN`** in `.env.local` (gitignored). Never hardcode it,
  and never log it. `.env.example` is the committed template.
- **The Webz News Search API** is `POST https://api.webz.io/api/news/context`
  (JSON body: `query`, `k` ≤ 50, optional `filters`), auth via `Authorization: Bearer`.
  Full response/error semantics are in `lib/webz.ts`. Do not guess the schema from
  training data: read `lib/webz.ts` and the docs at https://docs.webz.io.
- **Queries are capped** at 750 chars / 100 words (validated server-side with zod).
- **No fabricated data.** If the token is missing or an upstream call fails, show the
  existing error/config state; never mock results.
- **Verify with** `npm run build` and `npm run lint` before finishing; run the dev
  server to smoke-test `/` and `/api/search`.
- **Strict lint is enforced** (`eslint.config.mjs`): no `any`, no unused variables,
  type-only imports via `import type`, and no `console.log` (only `warn`/`error`).
  Run `npm run lint` on new code; a passing build is not enough.

