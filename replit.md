# Crème & Co.

A premium artisan cake-selling web app for Nairobi-based patisserie Crème & Co. — customers browse, order, and pay via MPesa; admins manage everything from a dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/cakeshop run dev` — run the storefront (port 18408, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed cakes, categories, and promotions
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + wouter + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)
- Payment: MPesa Daraja STK Push

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas for server validation
- `lib/db/src/schema/` — Drizzle schema (categories, cakes, customers, orders, payments, promotions)
- `artifacts/api-server/src/routes/` — Express route handlers (one file per resource)
- `artifacts/api-server/src/lib/mpesa.ts` — MPesa Daraja STK Push integration
- `artifacts/cakeshop/src/pages/` — storefront + admin pages
- `artifacts/cakeshop/src/lib/cart-context.tsx` — cart state (localStorage-persisted)
- `scripts/src/seed.ts` — database seeder

## Architecture decisions

- Contract-first: OpenAPI spec drives Orval codegen for both React hooks and Zod validation schemas.
- MPesa mock mode: when `MPESA_CONSUMER_KEY` is not set, `initiateStkPush` returns a mock response so dev works without credentials.
- All prices stored as `numeric` strings in PostgreSQL, parsed to `float` at API response boundary.
- Promotions use `any` cast for drizzle insert due to mixed Date/string/numeric types from Orval schema.
- Admin and storefront share the same React app (`artifacts/cakeshop`) with `/admin` prefix routes.

## Product

- **Storefront**: Browse cakes by category, view details, add to cart, checkout with MPesa STK Push, track order status
- **Admin**: Dashboard with revenue stats + chart, CRUD for cakes/categories/promotions, order management with status updates, customer and payment records

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Orval v8.9.1 does NOT support OpenAPI 3.1 array-syntax nullables (`type: ["string","null"]`) — use `nullable: true` (3.0 style) instead.
- Schema component names must NOT match `<OperationIdPascal>Body` — use entity-shaped names (e.g. `CakeInput`).
- Do NOT run `pnpm dev` at workspace root. Use `restart_workflow` or individual package scripts.
- Run `pnpm run typecheck:libs` before typechecking leaf packages — the composite libs must be built first.
- MPesa callback URL must be publicly accessible (use the `REPLIT_DOMAINS` env var in production).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
