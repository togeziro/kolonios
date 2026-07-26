# Changelog

## Unreleased

### Dependencies

#### Major Updates
- **Recharts** ^2.15.4 → ^3.10.0 — Major version upgrade with new components
- **react-resizable-panels** ^2.1.9 → ^4.12.2 — Major version upgrade
- **@types/node** ^22.12.0 → ^26.1.1 — TypeScript type definitions update
- **@faker-js/faker** ^9.9.0 → ^10.5.0 — Fake data generator major update

#### Minor Updates
- **sonner** ^1.7.4 → ^2.0.7 — Toast notification library update
- **vite-tsconfig-paths** ^5.1.4 → ^6.1.1 — Vite plugin for tsconfig paths
- **@testing-library/jest-dom** ^6.9.1 → ^7.0.0 — Jest DOM matchers update

### Added

- **Attendance schema** — New database tables for attendance management:
  - `locations` — Company office locations for geo-fencing (nama_lokasi, lat_kantor, long_kantor, radius)
  - `shifts` — Employee shift definitions (nama_shift, jam_masuk, jam_keluar)
  - `employee_shifts` — Daily attendance records (mapping shift with check-in/out times, coordinates)
  - `leaves` — Leave request system (cuti) with types: annual, sick, personal, emergency
  - `performance_reports` — Performance tracking (Laporan Kinerja)
  - `attendances` — Attendance history view

- **Masterdata schema** — New tables for employee management:
  - `employees` — Employee profiles linked to Better Auth users
  - `departments` — Company department structure
  - `designations` — Job titles/positions

- **RBAC extensions** — New roles in `permissions.ts`:
  - `hr` role — Attendance read/update, leave management, employee read
  - `employee` role — Self-service attendance check-in, view own history
  - `technician` role — Field worker equivalent to employee

- **Attendance documentation** — New `ATTENDANCE.md` with schema docs, API patterns, and security guardrails

### Changed

- **Removed

- **Static font loading removed** — All 9 font `@import` statements removed from `globals.css`. Fonts are now dynamically loaded per-theme via `src/lib/fonts.ts`, which maps each theme to its required fonts and uses Vite dynamic `import()` to inject font-face CSS on demand. Themes with no external font dependencies (Claude, WhatsApp) load zero fonts. Instead of downloading all 9 font packages (~hundreds of KB) on every page load, only the current theme's fonts are fetched.

### Changed

- **Codebase cleanup (spaghetti reduction)**: Applied a 10-task refactor across 4 passes:
  - Extracted shared `AuthShell` (v1 sign-in/sign-up) and `AuthCard` (v2 routes) — removed ~4 duplicated auth layouts.
  - Deduplicated product Zod schema + category options into the canonical `features/products` sources; fixed a latent lowercase-vs-uppercase category enum bug in the demo forms; dropped an `as any` cast.
  - Relocated `fetchGitHubRepo`/`formatCount` to `lib/github.ts` and `GitHubIcon` to `icons.tsx`.
  - Removed dead `useEffect` in `app-sidebar.tsx`; extracted shared `FilterClearButton` from 3 table-filter components; extracted `PasswordField` from auth forms; extracted `parseFilterValuesFromSearch`/`buildFilterSearchParams` from `use-data-table.ts` into `lib/parsers.ts`; split the 755-line `infobar.tsx` into 5 cohesive modules; extracted `ComboboxField`/`TagsField`/`SectionTitle` from `demo-form.tsx`; added `getProductOr404` helper to dedupe the load-row preamble in `db/products.ts`.

- **Auth**: Swapped custom JWT (`bcryptjs`, `jose`) for Better Auth.
  - Added `better-auth` + `@better-auth/drizzle-adapter` deps; removed `bcryptjs`, `jose`, `@types/bcryptjs`.
  - Generated Better Auth schema tables (`user`, `session`, `account`, `verification`).
  - New auth server config with `admin` plugin + `tanstackStartCookies`.
  - New auth client, permissions module, `/api/auth/$` route handler.
  - Deleted old `src/lib/auth/server.ts` and `src/lib/auth/client.tsx` (AuthProvider/useAuth).
  - Sign-in/register forms now call `authClient.*` directly.
  - Dashboard `beforeLoad` uses Better Auth session via `ensureSession`.
  - Dropped old `users` table + `user_role`/`user_status` enums (migrations 0005–0006).
  - Users data-access layer rewritten to use Better Auth admin API.
  - Seed script no longer seeds users.
  - Password fields on sign-in and register forms now have a show/hide eye toggle.

### Added

- Seeded a demo admin account `admin@example.com` / `Password123!` via `scripts/seed.ts` (`seedUsers`), so login can be tested immediately after `db:seed` (idempotent — skips if the email already exists).

### Fixed

- **Login 404/403** — Better Auth endpoints are multi-segment, so the API handler must be a catch-all splat route (`src/routes/api/auth/$.ts`); patched TanStack Start's `createStartHandler.js` so `server.handlers` fire on splat routes, with `scripts/postinstall.js` re-applying the patch after `bun install`.
- **Better Auth "Invalid origin" 403** — `baseURL` now uses a dynamic `allowedHosts` + `protocol: 'auto'` config (replaces the hardcoded `http://localhost:3000`) so Caddy-served dev hosts pass the CSRF origin check.
- **SSR restore (framework realignment)** — replaced the deprecated `@tanstack/react-router-with-query` (`v1.130.17`, incompatible with Router `v1.170.17`) with the official `@tanstack/react-router-ssr-query` (`v1.167.1`) and wired `setupRouterSsrQueryIntegration({ router, queryClient })` in `src/router.tsx`. Fixes the `isDehydrated` crash during SSR streaming.
- **`Buffer is not defined` client crash** — the `postgres` driver was reaching the browser bundle; `vite.config.ts` now aliases `Buffer → 'buffer'` and defines `global → globalThis`.
- **`data-theme="[object Object]"`** — `__root.tsx` loader now reads the active theme via `createServerOnlyFn` (imports `@tanstack/react-start/server` server-side only).
- **Users page 500** — `getUsers`/`createUser`/`updateUser`/`deleteUser` now pass `getRequestHeaders()` into every `auth.api.*` admin call, fixing `Dynamic baseURL could not be resolved`.
- **Notifications `filter is not a function`** — components now read `data?.notifications` (the query returns `NotificationsResponse`, not a bare array) and type it as `NotificationItem[]`.
- **Auth middleware TS error** — `authMiddleware` is now `.server()`-only (removed the `.client()` chain).
- **Data routes** — `product`, `users`, `kanban`, `notifications`, `overview` now use a `loader` that calls `queryClient.ensureQueryData(...)` with `ssr: 'data-only'`, so data prefetches on the server and hydrates on the client.

### Changed — Codebase Audit (2026-07-23)

- **Dead code identified for removal** (~530 lines across 10 files):
  - 9 unused component files: `src/components/nav-main.tsx`, `nav-projects.tsx`, `nav-user.tsx`, `github-stars-button.tsx`, `form-card-skeleton.tsx`, `user-avatar-profile.tsx`, `button-group.tsx`, `frame.tsx`, `resizable.tsx`
  - 1 unused hook: `src/hooks/use-media-query.ts` (duplicate of `useIsMobile`)
  - All 10 files deleted.
- **Dependency cleanups**:
  - Replaced `radix-ui` umbrella imports with individual `@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-separator`; removed `radix-ui` from package.json.
- **Duplicate auth routes retired**: V1 routes (`/auth/sign-in`, `/auth/sign-up`) deleted; redirects updated to point to `/auth/v2/sign-in`. Orphaned V1 components (`sign-in-view.tsx`, `sign-up-view.tsx`) deleted.
- **Duplicate "isMobile" hooks**: `useIsMobile` (`use-mobile.tsx`) and `useMediaQuery` (`use-media-query.ts`) both hardcode 768px. The latter is unused and deleted.
- **Theme/font fix**: Added 3 missing `@fontsource` imports to `globals.css` — `architects-daughter` (Notebook), `merriweather` (Astro Vista), `space-mono` (Neobrutualism). These fonts were installed but never loaded via `@import`, causing theme fonts to fall back to system defaults.
- **Kanban modular split**: Extracted `kanban.tsx` (1021 lines) into 7 files under `src/components/ui/kanban/` — `contexts.ts`, `root.tsx`, `board.tsx`, `column.tsx`, `item.tsx`, `overlay.tsx`, `index.ts`. Preserved all exports and import paths.
- **Demo form relocation**: Moved `demo-form.tsx` (695 lines) from `src/components/forms/` to `src/features/forms/` (more accurate feature placement). Updated all imports.

All changes above are committed on `dev` (HEAD `1ed928a`).

> **2026-07-23 update (post-compaction):** Pre-commit hooks activated, notifications IDOR fixed, docs realigned.

## [Unreleased after compaction]

### Security

- **Notifications IDOR fixed** — `user_id` column added to `notifications` schema.
  - Migration `0007_blue_mister_sinister.sql`: `ALTER TABLE notifications ADD COLUMN user_id text;`.
  - All five data-access functions (`getNotifications`, `markAsRead`, `markAllAsRead`, `addNotification`, `removeNotification`) now accept `userId` and scope queries with `AND user_id = ?`.
  - Server-function service layer threads `session.user.id` through every call.
  - Seed script assigns notifications to the demo admin user.
  - Cross-user isolation verified by 3 new integration tests.
  - Added `fallback: 'http://localhost:3000'` to Better Auth baseURL config so seed scripts resolve the Dynamic baseURL error.

### Infrastructure

- **Pre-commit hooks activated** — `npx simple-git-hooks` now runs `lint-staged && tsc --noEmit` on every commit.
- **Roadmap realigned** — PRD.md Now/Next/Later buckets rewritten to match current state. TODO.md restructured to match.
- **Font cleanup** — removed 2 unused font packages (`@fontsource-variable/playfair-display`, `@fontsource/merriweather`) that were imported but not referenced by any theme.

### Fixed

- **Kanban route module-load error** — "Failed to fetch dynamically imported module" on `/dashboard/kanban`. Root cause: stale Vite module graph cache from `src/components/ui/kanban.tsx` (1021-line monolith) being refactored into `src/components/ui/kanban/` (directory with `index.ts`). Vite still resolved `@/components/ui/kanban` imports to the old dead file path `/src/components/ui/kanban.tsx` (404), breaking the dynamic import chain for the kanban route component chunk. Fixed by restarting the Vite dev server to clear the resolution cache.

All notable changes to this project will be documented in this file.

## [0.1.0]

### Added

- JWT cookie-based auth with `bcryptjs` password hashing — server functions (`signInUserFn`, `signUpUserFn`, `getSessionFn`, `signOutUserFn`), `AuthProvider`/`useAuth()` context, `beforeLoad` route protection on `/dashboard`
- V1-style auth pages — 1/3 + 2/3 split-screen layout for sign-in and sign-up (replaces old placeholder pages)
- V2-style auth pages — 50/50 branded split-screen with centered card form at `/auth/v2/sign-in` and `/auth/v2/sign-up`
- Password field + "Remember me" checkbox in login form with `@tanstack/react-form` + Zod
- Register form with first/last name, email, password + confirm (Zod `.refine()` validation)
- `password_hash` column added to `users` table (migration `0004_flowery_steel_serpent`)
- Auth architecture docs — see [API.md](./API.md)

### Fixed

- Empty `AUTH_SECRET` now throws on startup instead of signing tokens with an empty key
- Auth handler bodies wrapped in try/catch — safe error logging, no stack leaks to client
- Signup TOCTOU race removed — catches PostgreSQL unique constraint violation instead of pre-check
- Email now lowercased/trimmed on both signup and signin for case-insensitive login
- "Remember me" checkbox now controls cookie `maxAge` (1 day unchecked, 30 days checked)
- `payload.sub` guarded — JWT without `sub` returns null session instead of crashing
- `serializeUser` types simplified to avoid Drizzle `PgColumn` type leaking into client

### Added

- PostgreSQL database layer with Drizzle ORM (products, users, kanban tables)
- Server-only data-access modules with dynamic imports
- Seed script for products (20), users (50), kanban board (4 columns, 10 tasks)
- Pre-commit hooks via simple-git-hooks + lint-staged (oxlint, oxfmt --check, tsc)
- React Query DevTools in root layout
- Kanban board migration from Zustand to PostgreSQL (schema, server functions, React Query)
- Input validation on kanban server functions
- FK constraint on kanban_tasks.column_slug
- Form reset and empty-title validation in new task dialog
- Race condition protection on kanban drag-drop mutations
- Cleanup of debounce timers on component unmount
- Testing setup: Vitest + Testing Library unit & integration tests for schemas, form validation, table parser, and product/user/kanban data-access against dedicated test DB
- `vite.config.ts` test configuration (test block, vitest.setup.ts with test DB env)
- `scripts/create-test-db.ts` and `src/test-utils/db.ts` helper for test isolation
- Added test scripts: `test`, `test:run`, `test:coverage`
- Playwright E2E tests (`e2e/`) for product CRUD (create/update/delete) and table sorting, plus `e2e` and `e2e:install` scripts and `playwright.config.ts` (auto-starts dev server, single worker to avoid DB races)

### Changed

- Removed deprecated `baseUrl` from tsconfig.json
- Upgraded lib target to ES2023

### Fixed

- Stale closure in kanban store (dbColumns captured via ref)
- Optimistic state not clearing on mutation error
- Null check on addTask database result
- Input validation in `getProducts`: page/limit clamped to safe ranges, categories filter normalized via `Array.isArray` + enum filtering, replacing `String()` garbage coercion
- Input validation in `createProduct`/`updateProduct`: `validateCategory()` guard replaces unsafe `as ProductCategory` cast; `validatePrice()` guard prevents null/NaN from reaching DB as `"null"`/`"NaN"` strings

### Removed

- Chat feature (routes, components, nav entry, notification mock) — decommissioned
- Dead chat leftovers: `open-chat` actionRoutes in notification center, `chat: IconMessage` icon alias, `IconMessage` import
- Zustand dependency — last consumer (notification center mock store) replaced with PostgreSQL + React Query

### Added

- Notification Drizzle schema (`notification_status` enum, `notifications` table with JSONB actions)
- Notification data-access layer (`src/lib/db/notifications.ts`)
- Notification server functions (`createServerFn`) — `getNotificationsFn`, `markAsReadFn`, `markAllAsReadFn`, `addNotificationFn`, `removeNotificationFn`
- Notification React Query keys, query options, and mutation options
- Notification integration tests (7 tests covering CRUD, status updates)
- Notification seed data (8 entries in `scripts/seed.ts`)
- DB migration `0003_cheerful_rumiko_fujikawa` (notifications table)
- `drizzle.config.ts` now uses explicit schema file list (avoids picking up `.test.ts` files)

### Changed

- Notification center components (`notification-center.tsx`, `notifications-page.tsx`): swapped Zustand store for `useQuery` + `useMutation`
- Deleted `src/features/notifications/utils/store.ts` (Zustand mock store) — no longer needed
