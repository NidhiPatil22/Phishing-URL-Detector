# PhishGuard

PhishGuard analyzes URLs and explains phishing risk in plain language before users click.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/phishguard/src/App.tsx` — user-facing routes, scanner, dashboard, history, model notes, auth and settings
- `artifacts/phishguard/src/index.css` — PhishGuard theme tokens and responsive visual system
- `artifacts/api-server/src/routes/phishguard.ts` — URL feature extraction, heuristic verdicts, demo auth and scan APIs
- `lib/api-spec/openapi.yaml` — source of truth for the generated API client and validation schemas

## Architecture decisions

- The first release keeps the detection engine local to the API server so the complete demo works without external API keys or a second runtime.
- URL analysis exposes both rule flags and extracted features, keeping the verdict explainable instead of presenting only a score.
- The frontend consumes the generated React Query client from the OpenAPI contract rather than hand-written request types.

## Product

- Public landing page with a quick-scan entry point
- Demo-friendly sign up, sign in, logout and password recovery screens
- URL scanner with risk score, confidence, rule-vs-model context, and feature breakdown
- Dashboard KPIs, recent scans, scan history search/filtering, model metrics, browser-helper preview, and appearance settings

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Regenerate API hooks with `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- The frontend and API are separate managed services; restart both workflows after service or contract changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
