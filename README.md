<p align="center">
  <img src="/public/tanstack-dashboard.png" alt="Kolonios Dashboard Cover" style="max-width: 100%; border-radius: 8px;" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/TanStack_Start-1.x-FF4154" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-336791" alt="PostgreSQL" />
</p>

# Kolonios

**Kolonios** is a production-ready **ISP / property management admin dashboard** built with **TanStack Start** (React 19 + Vite 7 + Nitro), **shadcn/ui**, **Tailwind CSS v4**, **Better Auth**, and **PostgreSQL (Drizzle ORM)**. It provides attendance tracking with geo-fencing, customer and employee management, masterdata CRUD, inventory (products), and a notification center behind a type-safe, feature-based codebase.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend (UI) | [React 19](https://react.dev), [TanStack Router](https://tanstack.com/router) (file-based, type-safe), [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev), [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS v4](https://tailwindcss.com), [Recharts](https://recharts.org), [motion](https://motion.dev), [kbar](https://kbar.vercel.app/) |
| Middle (server runtime & data) | [TanStack Start](https://tanstack.com/start) on [Vite 7](https://vite.dev) + [Nitro](https://nitro.build), [TanStack React Query](https://tanstack.com/query) with SSR dehydration via `@tanstack/react-router-ssr-query`, `createServerFn()` RPC boundary, server-side prefetch via route `loader` + `ensureQueryData({ ssr: 'data-only' })`, [Better Auth](https://better-auth.com) session + RBAC middleware |
| Backend (data & persistence) | [PostgreSQL](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team) (`postgres` driver), Better Auth DB-session store, server-only data-access layer with Zod-validated inputs and mapped DB errors, Nitro deploy presets (Vercel / Cloudflare / Node.js) |
| Tooling | [Bun](https://bun.sh) (runtime + scripts), [Vitest](https://vitest.dev) + [Playwright](https://playwright.dev) (tests), [oxlint](https://oxc.rs) + [oxfmt](https://oxc.rs) (lint/format) |

## Features

- **Admin dashboard layout** — sidebar, header, content area; responsive `MobileShell` for staff on mobile
- **Attendance module** — check-in/out with geo-fencing (Haversine), leave management, performance tracking, attendance history
- **Customer management** — full CRUD with search, filter & pagination; auto-generated customer codes
- **Employee management** — full CRUD with department joins and filtering
- **Masterdata CRUD** — department and designation management from the UI (create/edit/delete)
- **RBAC via role groups** — customizable role groups (Administrator, HR, Employee, Technician, + custom) with per-module permission toggles editable from the UI (`/dashboard/admin/role-groups`); the same permission map drives both the sidebar and every server function via `requirePermission(module, action)`
- **Data tables** — TanStack Table with React Query route loaders, client-side cache, search, filter & pagination driven by URL search params
- **Analytics overview** — Recharts cards with Suspense-based independent loading
- **Notification center** — bell icon badge, popover preview, and full page view (PostgreSQL-backed)
- **Command palette** — Cmd+K quick navigation
- **Multi-theme support** — 10+ OKLCH themes with easy switching
- **Hardened server-function RPC boundary** — `requireSession()`/`requirePermission(module, action)` at the handler (single authorization model via role groups), Zod-validated inputs, `DomainError` + `mapDbError`, rate limiting (HTTP 429), structured `pino` logging, `/api/v1` versioning
- **External integrations ready** — Tripay payment webhook handler with signature verification, MikroTik adapter scaffolding, integration layer at `src/integrations/`
- **Testing** — 465 Vitest unit/integration tests + Playwright E2E tests; CI runs lint, typecheck, tests, and build

## Pages

| Page | Description |
| :--- | :---------- |
| [Dashboard Overview](/dashboard/overview) | Cards with Recharts graphs, Suspense-bound loading. Mobile staff dashboard for employee/technician. |
| [Attendance](/dashboard/attendance) | Check-in/out with geo-fencing validation, today's status, attendance history table. |
| [Leave](/dashboard/leave) | Leave request form with type/date selection and leave history list. |
| [Customers](/dashboard/customers) | Customer CRUD with search, filter & pagination. |
| [Employees](/dashboard/employees) | Employee CRUD with department joins and filtering. |
| [Departments](/dashboard/admin/departments) | CRUD management for company departments. |
| [Job Titles](/dashboard/admin/designations) | CRUD for designations with department assignment and base salary. |
| [Role Groups](/dashboard/admin/role-groups) | RBAC group management: per-module permission toggles for each role group. |
| [Product List (Table)](/dashboard/product) | TanStack Table + React Query with URL search params for search, filter, pagination. |
| [Create Product Form](/dashboard/product/new) | TanStack Form + Zod with `useMutation` and cache invalidation. |
| [Users (Table)](/dashboard/users) | Users table with React Query + URL state pattern. |
| [Notifications](/dashboard/notifications) | Notification center with bell badge, popover preview, and full page with tabs. |
| [Not Found](/notfound) | Custom 404 page via TanStack Router's `defaultNotFoundComponent`. |

## Feature-based Organization

```plaintext
src/
├── routes/                        # TanStack Router file-based routes
│   ├── __root.tsx                 # Root layout (providers, theme, HTML shell)
│   ├── index.tsx                  # Home (auth redirect)
│   ├── auth/                      # Auth pages (sign-in, sign-up)
│   ├── dashboard.tsx              # Dashboard layout (sidebar/header or MobileShell)
│   ├── dashboard/                 # Dashboard pages (overview, attendance, customers,
│   │                              #   employees, product, users, admin, my-work, jobs,
│   │                              #   leave, notifications, profile)
│   └── api/v1/                    # Versioned API routes (/api/v1/auth/$ for Better Auth)
│
├── components/                    # Shared components
│   ├── ui/                        # UI primitives (buttons, inputs, skeletons, etc.)
│   ├── layout/                    # Layout components (header, sidebar, mobile-shell, bottom-nav)
│   ├── themes/                    # Theme system (selector, mode toggle, config)
│   └── kbar/                      # Command+K interface
│
├── features/                      # Feature-sliced modules
│   ├── attendance/                # Check-in/out, leave, performance (Haversine geo-fencing)
│   ├── customers/                 # Customer CRUD, code generation
│   ├── employees/                 # Employee CRUD with department joins
│   ├── masterdata/                # Departments & designations CRUD
│   ├── products/                  # Product listing, form, tables (React Query)
│   ├── role-groups/               # RBAC role groups (permission matrix UI + queries)
│   ├── users/                     # User management table (React Query)
│   ├── notifications/             # Notification center (React Query + PostgreSQL)
│   └── auth/                      # Auth components
│
├── lib/                           # Core utilities
│   ├── api/                       # API helpers
│   ├── auth/                      # Better Auth client + server config
│   ├── db/                        # Drizzle ORM connection, schema, migrations, server-only data access
│   │   ├── utils.ts               # Shared DB utilities (pagination, sorting, conditions)
│   │   ├── schema/                # Drizzle schema definitions
│   │   ├── customers.ts           # Customer CRUD (uses utils)
│   │   ├── employees.ts           # Employee CRUD (uses utils)
│   │   ├── masterdata.ts          # Department/designation CRUD (uses utils)
│   │   ├── attendance.ts          # Attendance CRUD (uses utils)
│   │   ├── audit.ts               # Audit log (uses utils)
│   │   └── tasks.ts               # Task management (uses utils)
│   ├── errors.ts                  # DomainError + mapDbError
│   ├── logger.ts                  # structured pino logger
│   ├── parsers.ts                 # sort/filter parsers
│   ├── rate-limit.ts              # rate limiter (returns HTTP 429 on exhaustion)
│   └── query-client.ts            # React Query client config
├── hooks/                         # Custom hooks (use-data-table, use-mobile, etc.)
├── config/                        # Navigation, infobar, data table config
├── styles/                        # Global CSS & theme files
└── types/                         # TypeScript types
```

## Getting Started

> Requires **Bun**, a running **PostgreSQL** instance, and Node.js-compatible tooling.

Clone the repo:

```bash
git clone <your-remote>/kolonios.git
cd kolonios
```

Install dependencies and configure environment:

```bash
bun install
bun run prepare     # activate pre-commit hooks
cp env.example.txt .env
```

> Fill in `DATABASE_URL` and a strong `AUTH_SECRET` in `.env` (see `env.example.txt`).

Apply the schema and seed the database:

```bash
bun run db:push    # apply the Drizzle schema to the database
bun run db:seed    # seed 20 products, masterdata (2 locations, 3 shifts, 6 departments,
                   #   13 designations), 4 role groups (Administrator/HR/Employee/Technician),
                   #   4 demo users, 4 employee records, customers,
                   #   + 1 demo user with 8 notifications
```

Run the development server:

```bash
bun run dev
```

Access the app at **http://localhost:3000**.

Log in with a seeded demo account:

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `Password123!` | admin |
| `hr@example.com` | `Password123!` | hr |
| `employee@example.com` | `Password123!` | employee |
| `technician@example.com` | `Password123!` | technician |

### Database Migrations

For versioned, production-style schema changes (instead of `db:push`):

```bash
bun run db:generate   # generate SQL migrations from schema changes
bun run db:migrate    # drizzle-kit migration runner
bun run db:migrate:run # apply pending migrations programmatically (scripts/migrate.ts)
```

> `db:migrate:run` auto-seeds the database when the `user` table is empty, so
> demo accounts (`admin@example.com` / `Password123!`, etc.) always exist after
> applying migrations to a fresh database. Run `bun run db:seed` manually only
> to force a re-seed.

> Switching an existing `db:push`-created database to versioned migrations:
> run `bun run db:baseline` once (records current migrations as applied), then
> use `db:generate` → `db:migrate:run` for all future changes.

### API Documentation (OpenAPI + Redoc)

The API surface is generated from the Zod validation schemas and rendered as
interactive docs via Redoc:

```bash
bun run api:docs    # writes public/openapi.json + public/api-docs.html
```

`bun run build` regenerates the docs automatically. After building, the docs
are served at `/api-docs.html` (the spec itself at `/openapi.json`). The
operation registry lives in `src/lib/api/openapi.ts`; each operation reuses
the actual request/response Zod schemas from `src/features/*/api/validation.ts`,
so documentation and runtime validation never drift.

### Testing

```bash
bun run test:run       # Vitest unit/integration tests
bun run e2e            # Playwright E2E tests (auto-starts dev server)
bun run test:coverage  # Vitest with coverage
```

### Lint / Typecheck / Format

```bash
bun run lint          # oxlint
bun run typecheck     # tsc --noEmit
bun run format:check  # oxfmt check
bun run format        # oxfmt write
```

## Deploy

The project builds with **Nitro** using the `bun` preset, producing a standalone Bun server in `.output/`.

### Build & Run (Bun server — default)

```bash
bun run build
bun run start    # serves the built app from .output/server/index.mjs
```

### Other Platforms

To target a different host, change the Nitro preset in `vite.config.ts`:

```ts
nitro({ preset: 'cloudflare-pages' }); // Cloudflare Pages
nitro({ preset: 'node-server' });      // Node.js server
nitro({ preset: 'netlify' });          // Netlify
nitro({ preset: 'vercel' });           // Vercel
```

> **Note:** Vercel/Cloudflare/Netlify presets are supported by Nitro but not the default build target. The maintained, tested path is the `bun` preset.

## Security

The server-function RPC boundary is hardened at every endpoint:

- **Authentication**: every `createServerFn` handler calls `requireSession()` at the boundary; privileged endpoints additionally call `requirePermission(module, action)`, which reads the caller's role-group permission map from the DB — enforcement is at the handler level, independent of route guards.
- **Input validation**: every endpoint validates input at runtime with a Zod schema via `@tanstack/zod-adapter`.
- **Error mapping**: DB errors are wrapped by `mapDbError` — intentional domain errors pass through as `DomainError` (with a stable `code`); unexpected errors become generic messages (no column/constraint names leak).
- **Rate limiting**: server functions are rate-limited; exceeding the limit returns **HTTP 429**.
- **Logging**: structured `pino` logging (pretty-printed in dev) replaces ad-hoc `console.error`.
- **API versioning**: routes are mounted under `/api/v1`, and auth under `/api/v1/auth/$`.
- **Notification IDOR**: all notification queries are scoped by `user_id`.

## Documentation

Detailed docs live in [`docs/`](./docs/):

| Doc | Contents |
|-----|----------|
| [docs/PRD.md](./docs/PRD.md) | Product requirements, features, security, roadmap |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Tech stack, data flow, patterns |
| [docs/API.md](./docs/API.md) | Server function & auth reference |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Notable changes |
| [docs/TODO.md](./docs/TODO.md) | Task tracking |
| [docs/ATTENDANCE.md](./docs/ATTENDANCE.md) | Attendance module deep-dive |
| [docs/MOBILE.md](./docs/MOBILE.md) | Mobile staff dashboard |
| [docs/audit/](./docs/audit/) | Repository audit + implementation summary |

## Code Quality & Architecture

- **Shared DB utilities**: Common patterns extracted to `src/lib/db/utils.ts` to reduce code duplication across DB modules (pagination, sorting, search conditions, filtering)
- **Consistent error handling**: All DB functions use `mapDbError` with consistent response format (`{ success, time, message, data? }`)
- **Type safety**: Server-only DB layer with Zod-validated inputs and proper error mapping
- **Testing**: 465+ Vitest tests + Playwright E2E tests; shared utilities have dedicated test suite
- **Code organization**: Feature-based structure with clear separation between routes, features, and shared libraries

## License

[MIT](./LICENSE)

---

<p align="center">
  <sub>Built with TanStack Start, Better Auth, and PostgreSQL. Feature-sliced and hardened for production.</sub>
</p>

<!--
SEO keywords:

tanstack start dashboard, isp management dashboard, property management admin,
attendance tracking, geo-fencing, customer management, employee management,
shadcn ui dashboard, admin dashboard starter, tanstack router, typescript dashboard,
better auth dashboard, drizzle orm postgresql dashboard
-->
