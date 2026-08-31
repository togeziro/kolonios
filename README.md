<p align="center">
  <img src="/public/tanstack-dashboard.png" alt="Kolonios Dashboard Cover" style="max-width: 100%; border-radius: 8px;" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/TanStack_Start-1.x-FF4154" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-336791" alt="PostgreSQL" />
</p>

# Kolonios

**Kolonios** is a production-ready **ISP / property management admin dashboard** built with **TanStack Start** (React 19 + Vite 8 + Nitro), **shadcn/ui**, **Tailwind CSS v4**, **Better Auth**, and **PostgreSQL (Drizzle ORM)**. It provides attendance tracking with geo-fencing, customer and employee management, masterdata CRUD, and a notification center behind a type-safe, feature-based codebase.

## Tech Stack

| Layer                          | Technology                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend (UI)                  | [React 19](https://react.dev), [TanStack Router](https://tanstack.com/router) (file-based, type-safe), [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev), [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS v4](https://tailwindcss.com), [Recharts](https://recharts.org), [motion](https://motion.dev)                                                                                      |
| Middle (server runtime & data) | [TanStack Start](https://tanstack.com/start) on [Vite 8](https://vite.dev) + [Nitro](https://nitro.build), [TanStack React Query](https://tanstack.com/query) with SSR dehydration via `@tanstack/react-router-ssr-query`, `createServerFn()` RPC boundary, server-side prefetch via route `loader` + `ensureQueryData({ ssr: 'data-only' })`, [Better Auth](https://better-auth.com) session + RBAC middleware |
| Backend (data & persistence)   | [PostgreSQL](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team) (`postgres` driver), Better Auth DB-session store, server-only data-access layer with Zod-validated inputs and mapped DB errors, Nitro deploy presets (Vercel / Cloudflare / Node.js)                                                                                                                                        |
| Tooling                        | [Bun](https://bun.sh) (runtime + scripts), [Vitest](https://vitest.dev) + [Playwright](https://playwright.dev) (tests), [oxlint](https://oxc.rs) + [oxfmt](https://oxc.rs) (lint/format)                                                                                                                                                                                                                        |

## Features

- **Shell registry (backoffice / fieldops / portal)** — a pure `resolveShell(role, roleGroup)` in `src/lib/shells/` decides the UI layout per user: admin/HR get the sidebar, **technicians** get the field/ops shell (`MobileShell` on phones, sidebar on desktop), and all other staff (Employee, custom groups) keep the sidebar on mobile too. Customers get the `/portal` route tree. Single shared sign-in page redirects each role to its shell. See [docs/UI_SHELLS.md](./docs/UI_SHELLS.md).
- **Customer portal (placeholder)** — `/portal` route tree with its own shell, guarded server-side by `requirePortalSession` (active customers only; blocked/inactive customers see a blocked message). Portal features (billing, wifi config, tickets) come later; customer accounts are admin-created.
- **Field/ops mobile shell (dark, technician-only)** — bottom nav with 4 tabs (Home, My Work, Office, Profile) + a center QR **Check-In** FAB on a fixed 4-slot grid (never overlaps a tab); dark-first `.dark` scoped shell with a light/dark toggle synced to `next-themes`. Leave moved into My Work.
- **Attendance module** — check-in/out with geo-fencing (Haversine), per-shift work schedules (weekday rules, date overrides, day offs), GPS & selfie policies, leave management, correction requests with admin approval, and admin reports with CSV/Excel/PDF export
- **Daily Checklist** — one equipment-check form per technician per business day: lazily created on working days only (day-off/holiday/no-schedule aware), ok/issue/pending outcomes with notes + photos, submit-for-review gating (issues require notes), reviewer notifications + audit trail; see [docs/CHECKLIST.md](./docs/CHECKLIST.md)
- **Holiday Calendar** — CRUD national/company holidays, API import from Nager.Date / OpenHolidays / Custom REST, calendar view, admin settings; feeds attendance day-off resolution
- **Payroll module** — full payroll calculation engine (monthly/daily/hourly, fixed/percentage/per-attendance/manual components, configurable absence/late/unpaid-leave deductions, progressive + TER tax), payslip PDF generation, printable admin payslips (Kerjoo §6.5 letterhead/NPWP/signature slip), admin UI with TanStack Table, employee self-service; MVP excludes overtime calculation
- **Ticket system** — `tasks` migrated to a full ticket system (`tickets` + estafet `ticket_legs`/`ticket_materials`/`ticket_photos`, code `T-{id}`): eligibility-gated Open Tickets pool (Take), Create Ticket with searchable customer picker, Ticket Detail (Estafet + Rework rejection banner) with leg timeline and Take/Start/Complete actions, **En Route navigation** (MapLibre map with live-GPS blue device marker, orange destination pin, dashed guide line, fitBounds, TurfJS distance readout, Open Maps handoff, arrival confirmation), Work Session (completion photos via S3, materials ±qty steppers, notes, Finish & Submit), Ticket Completed summary (rating + materials + photo grid), My Work tabs (In Progress / Available / Completed + pending approval), desktop Tickets nav group
- **Achievements** — technician self-service screen (`/dashboard/achievements`, linked from Profile): attendance streak card with week dots, weekly performance targets, and a 6-badge collection (OLT Master, Early Bird, Fast Finisher, All-rounder, Reliable, Night Owl). All metrics computed on the fly from existing attendance + ticket data (`getAchievementData` + pure `evaluateAchievements`) — zero new tables, no migration
- **S3-compatible object storage** — photos (attendance selfies, customer ID cards, ticket photos) upload directly to S3-compatible storage (IDrive e2 / AWS S3 / MinIO / Cloudflare R2 / custom) via short-lived presigned PUT URLs; Postgres stores only object keys. Provider + credentials configured from the admin UI (`/dashboard/admin/storage-settings`) with a Test Connection button and masked-secret handling; presigned GETs are IDOR-guarded (folder→permission map + per-user attendance ownership)
- **Customer management** — full CRUD with search, filter & pagination; auto-generated customer codes
- **Employee management** — full CRUD with department joins and filtering
- **Masterdata CRUD** — department and designation management from the UI (create/edit/delete)
- **RBAC via role groups** — customizable role groups (Administrator, HR, Employee, Technician, + custom) with per-module permission toggles editable from the UI (`/dashboard/admin/role-groups`); the same permission map drives both the sidebar and every server function via `requirePermission(module, action)`
- **Data tables** — TanStack Table with React Query route loaders, client-side cache, search, filter & pagination driven by URL search params
- **Analytics overview** — Recharts cards with Suspense-based independent loading
- **Notification center** — bell icon badge, popover preview, and full page view (PostgreSQL-backed)
- **Multi-theme support** — 13 OKLCH themes (all input/border tokens ≥3:1 WCAG contrast) with easy switching
- **Hardened server-function RPC boundary** — `requireSession()`/`requirePermission(module, action)` at the handler (single authorization model via role groups), Zod-validated inputs, `DomainError` + `mapDbError`, rate limiting (HTTP 429), structured `pino` logging, `/api/v1` versioning
- **External integrations ready** — Tripay payment webhook handler with signature verification, MikroTik adapter scaffolding, integration layer at `src/integrations/`
- **Testing** — 653+ Vitest unit/integration tests (holiday-calendar tests added) + Playwright E2E tests; CI runs lint, typecheck, tests, and build

## Pages

| Page                                                           | Description                                                                                                                                                                                                                    |
| :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Dashboard Overview](/dashboard/overview)                      | Cards with Recharts graphs, Suspense-bound loading. Dark technician dashboard (attendance, My Work, Available Jobs, performance) for `role === 'technician'`.                                                                  |
| [Attendance](/dashboard/attendance)                            | Check-in/out with geo-fencing validation, today's status, attendance history table.                                                                                                                                            |
| [Locations](/dashboard/admin/attendance/locations)             | Manage work locations with geofence radius, GPS/selfie policy, and a locate button (MapLibre map + manual coordinate inputs).                                                                                                  |
| [Schedules](/dashboard/admin/attendance/schedules)             | Create shifts with per-weekday rules.                                                                                                                                                                                          |
| [Assignments](/dashboard/admin/attendance/assignments)         | Assign schedules to employees (individual/bulk) and create day offs.                                                                                                                                                           |
| [Reports](/dashboard/admin/attendance/reports)                 | Daily detail filtered by date/location/shift/status; export CSV, Excel, PDF.                                                                                                                                                   |
| [Leave](/dashboard/leave)                                      | Leave request form with type/date selection and leave history list.                                                                                                                                                            |
| [My Work](/dashboard/my-work)                                  | Technician/SPV tabs: In Progress / Available / Completed + pending approval (dark mobile shell).                                                                                                                               |
| [Achievements](/dashboard/achievements)                        | Technician streak card, weekly targets, and badges grid (Profile sub-page).                                                                                                                                                    |
| [Available Jobs](/dashboard/jobs)                              | Eligibility-gated open-ticket pool with Take action (bottom-nav "Office"); Location/Priority filter chips + "Leg x of y" relay badges.                                                                                         |
| [New Ticket](/dashboard/tickets/new)                           | Create a ticket: type/channel, customer, asset, location, priority, estafet legs.                                                                                                                                              |
| [Ticket Detail](/dashboard/tickets/$ticketId)                  | Ticket header, leg progress + timeline, Take/Start/Complete actions; rework rejection banner.                                                                                                                                  |
| [En Route](/dashboard/en-route/$ticketId)                      | MapLibre preview map: live-GPS blue device marker, orange destination pin, dashed guide line, fitBounds, TurfJS distance to destination, Open Maps handoff, "I've Arrived". Deep-dive: [docs/EN_ROUTE.md](./docs/EN_ROUTE.md). |
| [Work Session](/dashboard/work-session/$ticketId)              | In-progress ticket working view: completion photos (camera + S3 upload), materials ±qty steppers, notes, Finish & Submit.                                                                                                      |
| [Ticket Completed](/dashboard/tickets/$ticketId/completed)     | Success summary: rating, materials, photo grid, full leg timeline.                                                                                                                                                             |
| [Settings](/dashboard/settings)                                | Mobile settings hub: profile card + edit link, live Language and Light/Dark theme rows, Change Password link, About (app version), Log Out.                                                                                    |
| [Change Password](/dashboard/change-password)                  | Current/new/confirm fields with visibility toggles, strength meter, inline validation; changes the password via Better Auth.                                                                                                   |
| [Edit Profile](/dashboard/edit-profile)                        | Display name save + avatar upload (initials fallback when storage is unconfigured); email locked ("contact HR"); work info read-only.                                                                                          |
| [SPV Review Queue](/dashboard/spv/review)                      | Submitted Daily Checklist review: count strip, context-rich cards, Approve/Reject (stub toast); gated by `checklist.approve`.                                                                                                  |
| [Review Ticket](/dashboard/spv/review/$ticketId)               | SPV evidence audit for a submitted ticket: summary, leg progress bar, engineer, photos, work summary, materials, SOP pill.                                                                                                     |
| [Leave Approvals](/dashboard/spv/leave-approvals)              | Leave request queue: summary chips, Pending/Approved/Rejected tabs, Paid/Unpaid flags with deduction hint; gated by `spv_review.view`.                                                                                         |
| [Customer Portal](/portal)                                     | Customer self-service portal (placeholder shell; billing/wifi/tickets coming later).                                                                                                                                           |
| [Customers](/dashboard/customers)                              | Customer CRUD with search, filter & pagination.                                                                                                                                                                                |
| [Employees](/dashboard/employees)                              | Employee CRUD with department joins and filtering.                                                                                                                                                                             |
| [Departments](/dashboard/admin/departments)                    | CRUD management for company departments.                                                                                                                                                                                       |
| [Job Titles](/dashboard/admin/designations)                    | CRUD for designations with department assignment and base salary.                                                                                                                                                              |
| [Role Groups](/dashboard/admin/role-groups)                    | RBAC group management: per-module permission toggles for each role group.                                                                                                                                                      |
| [Users (Table)](/dashboard/users)                              | Users table with React Query + URL state pattern.                                                                                                                                                                              |
| [Notifications](/dashboard/notifications)                      | Notification center with bell badge, popover preview, and full page with tabs.                                                                                                                                                 |
| [Holiday Calendar](/dashboard/admin/holiday-calendar)          | CRUD national/company holidays, API import, calendar view, admin settings.                                                                                                                                                     |
| [Holiday Settings](/dashboard/admin/holiday-calendar/settings) | Holiday API provider configuration (Nager.Date / OpenHolidays / Custom REST).                                                                                                                                                  |
| [Storage Settings](/dashboard/admin/storage-settings)          | S3-compatible object storage config: provider presets, endpoint/region/bucket, access keys, Test Connection.                                                                                                                   |
| [Payroll](/dashboard/admin/payroll)                            | Admin payroll dashboard: overview, components, periods, generate/review, records, reports.                                                                                                                                     |
| [My Payslips](/dashboard/payroll/payslips)                     | Employee self-service: payslip history with PDF download.                                                                                                                                                                      |
| [Not Found](/notfound)                                         | Custom 404 page via TanStack Router's `defaultNotFoundComponent`.                                                                                                                                                              |

## Feature-based Organization

```plaintext
src/
├── routes/                        # TanStack Router file-based routes
│   ├── __root.tsx                 # Root layout (providers, theme, HTML shell)
│   ├── index.tsx                  # Home (auth redirect)
│   ├── auth/                      # Auth pages (sign-in, sign-up)
│   ├── dashboard.tsx              # Dashboard layout — shell registry decides sidebar vs MobileShell
│   ├── portal.tsx                 # Customer portal layout (guard + PortalShell)
│   ├── portal/                    # Portal pages (placeholder today)
│   ├── dashboard/                 # Dashboard pages (overview, attendance, customers,
│   │                              #   employees, users, admin, my-work, jobs, tickets,
│   │                              #   leave, notifications, profile)
│   └── api/v1/                    # Versioned API routes (/api/v1/auth/$ for Better Auth)
│
├── components/                    # Shared components
│   ├── ui/                        # UI primitives (buttons, inputs, skeletons, etc.)
│   ├── layout/                    # Layout components (header, sidebar, mobile-shell, bottom-nav)
│   ├── themes/                    # Theme system (selector, mode toggle, config)
│
├── features/                      # Feature-sliced modules
│   ├── attendance/                # Check-in/out, leave, performance (Haversine geo-fencing)
│   ├── achievements/              # Technician streak, weekly targets, badges (computed from attendance + tickets)
│   ├── tickets/                   # Ticket system: create/detail, leg timeline, jobs pool (replaces tasks)
│   ├── customers/                 # Customer CRUD, code generation
│   ├── employees/                 # Employee CRUD with department joins
│   ├── masterdata/                # Departments & designations CRUD
│   ├── payroll/                   # Payroll calculation engine, payslips, admin UI
│   ├── role-groups/               # RBAC role groups (permission matrix UI + queries)
│   ├── users/                     # User management table (React Query)
│   ├── notifications/             # Notification center (React Query + PostgreSQL)
│   ├── storage/                   # S3-compatible storage: settings UI, presign server functions
│   └── auth/                      # Auth components
│
├── lib/                           # Core utilities
│   ├── shells/                    # Shell registry (config + resolveShell/resolveHomePath, pure)
│   ├── portal/                    # Customer portal access classifier (pure)
│   ├── api/                       # API helpers
│   ├── auth/                      # Better Auth client + server config
│   ├── db/                        # Drizzle ORM connection, schema, migrations, server-only data access
│   │   ├── utils.ts               # Shared DB utilities (pagination, sorting, conditions)
│   │   ├── schema/                # Drizzle schema definitions
│   │   ├── customers.ts           # Customer CRUD (uses utils)
│   │   ├── employees.ts           # Employee CRUD with joins (uses utils)
│   │   ├── masterdata.ts          # Department/designation CRUD (uses utils)
│   │   ├── attendance.ts          # Attendance CRUD with Haversine (uses utils)
│   │   ├── achievements.ts        # Achievement aggregates: streak, monthly stats, ticket counts (uses utils)
│   │   ├── payroll.ts             # Payroll data access with effective-date resolution (uses utils)
│   │   ├── audit.ts               # Audit log (uses utils)
│   │   └── tickets.ts               # Ticket/leg system (replaces tasks.ts, uses utils)
│   ├── errors.ts                  # DomainError + mapDbError
│   ├── logger.ts                  # structured pino logger
│   ├── parsers.ts                 # sort/filter parsers
│   ├── rate-limit.ts              # rate limiter (returns HTTP 429 on exhaustion)
│   ├── storage/                   # Server-only S3 layer: presign client, key builders, provider presets
│   │   ├── types.ts               # StorageProvider / StorageConfig types
│   │   ├── keys.ts                # Object key builders (attendance/customers/tickets)
│   │   ├── config.ts              # Provider presets + deriveStorageConfig from company_settings
│   │   ├── presign.ts             # buildStorageClient, presigned PUT/GET URLs, testConnection
│   │   └── upload-client.ts       # Client-side uploadSelfie helper (presigned direct upload)
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
bun run db:migrate:run  # apply all Drizzle migrations (auto-seeds on a fresh DB)
```

`db:migrate:run` applies every committed migration and auto-seeds on a fresh
database (4 demo users, 4 employee records, role groups, customers, etc.), so
no separate `db:seed` is needed on a new checkout. Run `bun run db:seed`
manually only to force a re-seed.

```bash
bun run db:seed          # optional: force a re-seed
                         # SEED_DEMO_ACHIEVEMENTS=1 bun run db:seed adds the
                         #   demo technician's attendance history + 10 completed
                         #   inspection tickets so the Achievements screen shows
                         #   unlocked badges (OLT Master, Early Bird, Reliable)
                         #
                         # Note: a plain db:seed run wipes that demo state
                         #   (tickets + attendance are re-seeded from scratch).
                         #   The local .env sets SEED_DEMO_ACHIEVEMENTS=1 so a
                         #   plain `bun run db:seed` restores it automatically.
bun run db:reset         # nuclear option: drop + recreate the DATABASE_URL
                         # database, apply all migrations, seed fresh demo data
```

Run the development server:

```bash
bun run dev
```

Access the app at **http://localhost:3000**.

Log in with a seeded demo account:

| Email                    | Password       | Role       |
| ------------------------ | -------------- | ---------- |
| `admin@example.com`      | `Password123!` | admin      |
| `hr@example.com`         | `Password123!` | hr         |
| `employee@example.com`   | `Password123!` | employee   |
| `technician@example.com` | `Password123!` | technician |
| `customer1@example.com`  | `Password123!` | customer   |

### Database Migrations

Versioned migrations are the **single** schema-application workflow:

```bash
bun run db:generate    # generate SQL migrations from schema changes
bun run db:migrate:run # apply pending migrations programmatically (scripts/migrate.ts)
bun run db:check       # verify schema ↔ migrations are in sync (also runs in CI)
```

> **Always** change the schema via `db:generate` → `db:migrate:run`. CI applies
> all migrations to a fresh test database and runs `db:check` on every PR, so a
> schema change without a committed migration fails the build.

> `db:push` exists only as a throwaway-prototyping escape hatch — it applies the
> schema without recording anything in the migration journal. Never mix it into
> the versioned workflow: a DB touched by `db:push` will cause `db:migrate:run`
> to fail with `relation "..." already exists`. Reconcile such a database once
> with `bun run db:baseline`, then use migrations exclusively.

### API Documentation (OpenAPI + Redoc)

The API surface is generated from the Zod validation schemas and rendered as
interactive docs via Redoc:

```bash
bun run api:docs    # writes public/openapi.json + public/api-docs.html
```

`bun run build` regenerates the docs automatically. After building, the docs
are served at `/api-docs.html` (the spec itself at `/openapi.json`). The
operation registry lives in `scripts/lib/openapi.ts`; each operation reuses
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
nitro({ preset: 'node-server' }); // Node.js server
nitro({ preset: 'netlify' }); // Netlify
nitro({ preset: 'vercel' }); // Vercel
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

| Doc                                                                                    | Contents                                                             |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [docs/PRD.md](./docs/PRD.md)                                                           | Product requirements, features, security, roadmap                    |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                                         | Tech stack, data flow, patterns                                      |
| [docs/API.md](./docs/API.md)                                                           | Server function & auth reference                                     |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md)                                               | Notable changes                                                      |
| [docs/TODO.md](./docs/TODO.md)                                                         | Task tracking                                                        |
| [docs/ATTENDANCE.md](./docs/ATTENDANCE.md)                                             | Attendance module deep-dive                                          |
| [docs/MOBILE.md](./docs/MOBILE.md)                                                     | Mobile staff dashboard                                               |
| [docs/UI_SHELLS.md](./docs/UI_SHELLS.md)                                               | Shell registry + customer portal architecture 🆕                     |
| [docs/PAYROLL.md](./docs/PAYROLL.md)                                                   | Payroll module deep-dive 🆕                                          |
| [docs/KERJOO_PAYROLL_REFERENCE.md](./docs/KERJOO_PAYROLL_REFERENCE.md)                 | Kerjoo payroll requirement reference (finish-payroll scope) 🆕       |
| [docs/BUILD_LIST_FROM_KERJOO_DASHBOARD.md](./docs/BUILD_LIST_FROM_KERJOO_DASHBOARD.md) | Competitive gap analysis vs Kerjoo: prioritized build list 🆕        |
| [docs/KERJOO_FEATURES_COMPLETE.md](./docs/KERJOO_FEATURES_COMPLETE.md)                 | Complete Kerjoo feature list (live sidebar, 18 groups) 🆕            |
| [docs/KERJOO_VS_KOLONIOS_COMPARISON.md](./docs/KERJOO_VS_KOLONIOS_COMPARISON.md)       | Kerjoo vs Kolonios feature comparison + sidebar structure 🆕         |
| [docs/MISSING_FEATURES_PRIORITIZED.md](./docs/MISSING_FEATURES_PRIORITIZED.md)         | Prioritized gap action plan with effort estimates 🆕                 |
| [docs/TICKETS.md](./docs/TICKETS.md)                                                   | Ticket system + field ops (Stitch-driven design spec) 🆕             |
| [docs/EN_ROUTE.md](./docs/EN_ROUTE.md)                                                 | En Route navigation deep-dive: data flow, fix validation, testing 🆕 |
| [docs/audit/](./docs/audit/)                                                           | Repository audit + implementation summary                            |

## Code Quality & Architecture

- **Shared DB utilities**: Common patterns extracted to `src/lib/db/utils.ts` to reduce code duplication across DB modules (pagination, sorting, search conditions, filtering)
- **Consistent error handling**: All DB functions use `mapDbError` with consistent response format (`{ success, time, message, data? }`)
- **Type safety**: Server-only DB layer with Zod-validated inputs and proper error mapping
- **Testing**: 653+ Vitest tests (holiday-calendar tests added) + Playwright E2E tests; shared utilities have dedicated test suite
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
