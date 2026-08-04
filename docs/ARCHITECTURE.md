# Architecture

## Overview

TanStack Start meta-framework with Vite 7, React 19, and Nitro for production builds.

## Data Flow

1. Route `loader` calls `queryClient.ensureQueryData(queryOptions(filters))` with `ssr: 'data-only'` so data is prefetched on the server.
2. Server functions (`createServerFn()`) run on the server and use dynamic `import()` to reach the DB layer (keeps the `postgres` driver out of the client bundle).
3. `@tanstack/react-router-ssr-query` dehydrates the prefetched query cache into the HTML; the client rehydrates it via `setupRouterSsrQueryIntegration({ router, queryClient })`.
4. Components consume the hydrated cache with `useQuery(queryOptions(...))` — no refetch on first paint because the key matches the dehydrated entry.
5. Mutations invalidate the React Query cache for automatic refetch.

## Directory Structure

```
e2e/                            # Playwright end-to-end tests (helpers, specs, fixtures)
src/
├── routes/                     # File-based routing (TanStack Router)
│   ├── __root.tsx              # Root layout (providers, theme, HTML shell)
│   ├── index.tsx               # Home (auth redirect)
│   ├── dashboard.tsx           # Conditional layout: MobileShell vs sidebar
│   ├── api/v1/auth/$           # Better Auth catch-all handler (versioned)
│   └── dashboard/              # Dashboard pages
│       ├── overview.tsx        # Analytics or StaffMobileDashboard
│       ├── attendance/         # Check-in/out page
│       ├── leave/              # Leave management
│       ├── my-work/            # Assigned task list (mobile)
│       ├── jobs/               # Available jobs pool (mobile)
│       ├── profile.tsx         # Profile + month summary
│       ├── admin/              # Departments, designations, role groups, audit log,
│       │                       #   attendance admin (locations, schedules, assignments, reports)
│       ├── users.tsx           # Users table
│       ├── customers.tsx       # Customer CRUD
│       ├── employees.tsx       # Employee CRUD
│       ├── product/            # Product CRUD
│       └── notifications.tsx   # Notifications page
├── features/                   # attendance, audit, auth, customers, employees,
│   │                           # masterdata, notifications, overview, products,
│   │                           # profile, role-groups, tasks, users
│   ├── <name>/
│   │   ├── api/                # Types, server functions, queries, mutations
│   │   ├── components/         # Feature-specific components
│   │   └── utils/              # Feature-specific utilities
│   └── role-groups/            # RBAC role group CRUD + permission matrix UI
├── lib/
│   ├── auth/                   # Better Auth server + client config + permissions
│   └── db/                     # Drizzle schema, migrations, data access
│       ├── utils.ts            # Shared DB utilities (pagination, sorting, conditions)
│       ├── schema/             # Drizzle schema definitions
│       ├── customers.ts        # Customer CRUD (uses utils)
│       ├── employees.ts        # Employee CRUD (uses utils)
│       ├── masterdata.ts       # Department/designation CRUD (uses utils)
│       ├── attendance.ts       # Attendance CRUD (uses utils)
│       ├── audit.ts            # Audit log (uses utils)
│       └── tasks.ts            # Task management (uses utils)
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── layout/                 # Sidebar, header, mobile-shell, bottom-nav, mobile-header
│   ├── themes/                 # Theme system (selector, mode toggle, config)
│   └── kbar/                   # Command+K interface
├── hooks/                      # Custom hooks
├── config/                     # Navigation, infobar, data table config
├── i18n/                       # Internationalization (i18next, EN/ID)
├── constants/                  # Option constants, seed patterns
├── styles/                     # Global CSS & theme files
└── types/                      # TypeScript types
```

## Key Patterns

- **Server functions**: `createServerFn()` with `import()` inside handlers
- **State management**: React Query for all server state (products, customers, employees, users, notifications, attendance, masterdata)
- **DB access**: Server-only modules in `src/lib/db/`, never imported by client code
- **Shared DB utilities**: Common patterns extracted to `src/lib/db/utils.ts`:
  - `buildPagination()` - consistent pagination with clamping (1-100 limit)
  - `parseSort()` + `buildOrderBy()` - unified sorting logic
  - `buildSearchCondition()` - search across multiple fields
  - `buildStatusCondition()` - status filter helper
  - `buildConditions()` - WHERE condition builder
- **Mutation callbacks**: CRUD components compose their `useMutation` options with `mergeMutationCallbacks(baseOptions, extra)` (`src/lib/mutation-options.ts`) so the shared `onSuccess` invalidations always run alongside component-specific callbacks — never spread-overridden.
- **RPC boundary authz**: Every `createServerFn` endpoint enforces a valid session at the boundary (not just the route `beforeLoad`) via `requireSession()`. Module endpoints additionally call `requirePermission(module, action)`, which resolves the caller's role-group permission map from the DB (`user_role_groups` → `role_groups.permissions`). Authorization is unified: `role_groups.is_admin` is the single admin bypass; legacy helpers (`requireRole`, `requireMinRole`, etc.) have been removed.
- **Input validation**: Every server-function input is validated at runtime with a Zod schema via `@tanstack/zod-adapter`.
- **Error mapping**: `lib/db/*.ts` functions are wrapped in `try/catch` using the shared `mapDbError`. Intentional domain errors throw `DomainError` (pass through); unexpected DB errors become a generic message. All DB functions include `time` field in response for consistency.
- **Mobile layout**: Conditional `MobileShell` renders when user is `employee`/`technician` and screen <768px; replaces sidebar/header with bottom nav + FAB.
- **Pre-commit hooks**: simple-git-hooks + lint-staged (oxlint, oxfmt --check, tsc --noEmit)
- **E2E testing**: Playwright tests in `e2e/` auto-start the dev server, run headless Chromium with a single worker (shared DB).

> **Notifications** are owner-scoped by `user_id` (IDOR resolved 2026-07-23).

## Authentication Flow

Auth uses **Better Auth** (DB-session based) via the `admin` plugin for the base role/ban model. See [API.md](./API.md) for full details.

1. Sign-in/sign-up forms call `authClient.signIn.email` / `authClient.signUp.email` directly
2. Better Auth manages session cookies via the `tanstackStartCookies` plugin
3. API handler at `/api/v1/auth/$` handles all Better Auth requests (GET/POST)
4. Dashboard routes use `beforeLoad` guard — calls `auth.api.getSession({ headers })`, redirects to `/auth/sign-in` if unauthenticated
5. Sign-out via `authClient.signOut()` clears the session
6. Fine-grained authorization is DB-backed: each user is assigned a **role group** (`user_role_groups` → `role_groups`), whose JSONB permission map is consulted by `requirePermission(module, action)` at every server function and by the sidebar via `useRoleGroupPermissions`. The `role_groups.is_admin` flag is the single admin bypass. Legacy role helpers have been removed; `user.role` is retained only for Better Auth compatibility.

## Permission model (role groups)

| Concept | Location |
| ------- | -------- |
| `role_groups` table (id, name, description, permissions JSONB, is_admin) | `src/lib/db/schema/role-groups.ts` |
| `user_role_groups` junction (user_id → role_group_id) | `src/lib/db/schema/user-role-groups.ts` |
| CRUD + `getUserRoleGroup`/`setUserRoleGroup` + `mapRoleGroupToLegacyRole` | `src/lib/db/role-groups.ts` |
| Pure check `hasModulePermission(permissions, isAdmin, module, action)` | `src/lib/auth/session.ts` |
| Server guard `requirePermission(module, action)` | `src/lib/auth/session.ts` |
| Client hook `useRoleGroupPermissions` + nav filtering | `src/hooks/use-nav.ts` |
| Nav config with `module` keys per item | `src/config/nav-config.ts` |

Permission keys are `<module>.<action>` pairs — e.g. `products.add`, `employees.view`, `audit_log.view` — with actions `view` / `add` / `edit` / `delete`. A role group with `is_admin = true` bypasses all checks. Module keys: `overview`, `my_work`, `jobs`, `attendance`, `attendance_admin`, `leave`, `profile`, `products`, `customers`, `employees`, `users`, `departments`, `designations`, `audit_log`, `role_groups`, `notifications`. (`attendance_admin` is a nav-gating-only module used by the admin attendance routes; the admin attendance server functions enforce `attendance.edit`/`attendance.delete`. HR retains `attendance.edit` by intentional product decision — attendance expansion, 2026-08-04.)

Because the client sidebar and server guards read the same map, UI visibility and server enforcement can never drift.

## Tech Stack

### Meta-Framework & Core

| Technology            | Version          | Purpose                    |
| --------------------- | ---------------- | -------------------------- |
| TanStack Start        | v1.168.27        | Full-stack meta-framework  |
| React                 | v19.0.0          | UI library                 |
| Vite                  | v7.0.2           | Build tool / dev server    |
| Nitro                 | v3.0.260415-beta | Server engine / deployment |
| TypeScript            | v5.7.2           | Language                   |
| bun (package manager) | —                | Package manager            |

### Routing & Data Fetching

| Technology                       | Version   | Purpose                                       |
| -------------------------------- | --------- | --------------------------------------------- |
| TanStack Router                  | v1.170.17 | File-based type-safe routing                  |
| TanStack Router DevTools         | v1.167.0  | Route dev tools                               |
| TanStack React Query             | v5.101.2  | Server state / data fetching                  |
| TanStack React Query DevTools    | v5.101.2  | Query dev tools                               |
| @tanstack/react-router-ssr-query | v1.167.1  | Router + Query SSR bridge (dehydrate/hydrate) |
| @tanstack/router-plugin          | v1.168.19 | Vite plugin for route generation              |
| @tanstack/zod-adapter            | v1.167.0  | Zod validation for route params               |

### UI Components

| Technology               | Version  | Purpose                         |
| ------------------------ | -------- | ------------------------------- |
| shadcn/ui (new-york)     | —        | 60+ UI primitives               |
| Radix UI                 | —        | 18 headless UI primitives       |
| @radix-ui/react-icons    | v1.3.2   | Icon set                        |
| class-variance-authority | v0.7.1   | Component variant definitions   |
| clsx                     | v2.1.1   | Conditional class names         |
| tailwind-merge           | v3.5.0   | Tailwind class merging          |
| cmdk                     | v1.1.1   | Command menu primitive          |
| vaul                     | v1.1.2   | Drawer component                |
| sonner                   | v2.0.7  | Toast notifications             |
| input-otp                | v1.4.2  | OTP input                       |
| react-resizable-panels   | v4.12.2 | Resizable panels                |
| motion                   | v11.18.2 | Animations (Framer Motion v11+) |

### Forms & Validation

| Technology       | Version  | Purpose               |
| ---------------- | -------- | --------------------- |
| TanStack Form    | v1.33.0  | Form state management |
| Zod              | v4.3.6   | Schema validation     |
| react-dropzone   | v14.4.1  | File upload           |
| react-day-picker | v9.14.0  | Date picker           |

### State Management

| Technology           | Version  | Purpose                                               |
| -------------------- | -------- | ----------------------------------------------------- |
| TanStack React Query | v5.101.2 | Server state (products, customers, employees, users, notifications) |

### Tables & Charts

| Technology     | Version | Purpose                                      |
| -------------- | ------- | -------------------------------------------- |
| TanStack Table | v8.21.3 | Data tables (sorting, filtering, pagination) |
| Recharts       | v3.10.0 | Charts (area, bar, pie)                      |
| date-fns       | v4.1.0  | Date formatting                              |

### Maps & Export (attendance)

| Technology  | Version  | Purpose                                   |
| ----------- | -------- | ----------------------------------------- |
| maplibre-gl | ^6.1.0   | Admin location editor geofence map        |
| @types/geojson | —    | GeoJSON types for MapLibre                |
| xlsx        | 0.20.3 (SheetJS tarball) | Excel export for attendance reports   |
| pdf-lib     | ^1.17.1  | PDF export for attendance reports         |

### Styling & Themes

| Technology        | Version | Purpose                            |
| ----------------- | ------- | ---------------------------------- |
| Tailwind CSS      | v4.3.1  | Utility-first CSS                  |
| @tailwindcss/vite | v4.3.1  | Tailwind Vite plugin               |
| tw-animate-css    | v1.4.0  | CSS animation utilities            |
| next-themes       | v0.4.6  | Theme provider (dark/light/system) |

### Fonts

| Font                      | Source                                       |
| ------------------------- | -------------------------------------------- |
| Geist Sans                | @fontsource/geist-sans v5.2.5                |
| Geist Mono                | @fontsource/geist-mono v5.2.7                |
| Inter Variable            | @fontsource-variable/inter v5.1.2            |
| DM Sans Variable          | @fontsource-variable/dm-sans v5.1.3          |
| Outfit Variable           | @fontsource-variable/outfit v5.1.2           |
| Fira Code Variable        | @fontsource-variable/fira-code v5.1.2        |
| JetBrains Mono Variable   | @fontsource-variable/jetbrains-mono v5.1.3   |
| Space Mono                | @fontsource/space-mono v5.0.20               |
| Architects Daughter       | @fontsource/architects-daughter v5.0.17      |

### Command Palette

| Technology | Version        | Purpose               |
| ---------- | -------------- | --------------------- |
| kbar       | v0.1.0-beta.48 | Cmd+K command palette |

### Icons

| Technology            | Version | Purpose           |
| --------------------- | ------- | ----------------- |
| @tabler/icons-react   | v3.40.0 | 175+ icons        |
| @radix-ui/react-icons | v1.3.2  | Calendar chevrons |

### Mock Data

| Technology      | Version | Purpose              |
| --------------- | ------- | -------------------- |
| @faker-js/faker | v10.5.0 | Seed data generation |
| uuid            | v11.1.0 | ID generation        |

### Database & ORM

| Technology  | Version  | Purpose                  |
| ----------- | -------- | ------------------------ |
| PostgreSQL  | 17       | Relational database      |
| drizzle-orm | v0.45.2  | Type-safe SQL ORM        |
| postgres    | v3.4.9   | PostgreSQL driver        |
| drizzle-kit | v0.31.10 | Schema migrations / push |

### Testing

| Technology                  | Version | Purpose                             |
| --------------------------- | ------- | ----------------------------------- |
| Vitest                      | v4.1.10 | Unit & integration test runner      |
| @testing-library/react      | v16.3.2 | React component testing             |
| @testing-library/jest-dom   | v7.0.0  | DOM-specific matchers               |
| @testing-library/user-event | v14.6.1 | User interaction simulation         |
| jsdom                       | v29.1.1 | DOM environment for Vitest          |
| Playwright                  | v1.61.1 | End-to-end browser tests (Chromium) |

### Linting & Formatting

| Technology | Version | Purpose              |
| ---------- | ------- | -------------------- |
| oxlint     | v1.59.0 | Rust-based linter    |
| oxfmt      | v0.44.0 | Rust-based formatter |

### Quality & Tooling

| Technology       | Version | Purpose                                |
| ---------------- | ------- | -------------------------------------- |
| simple-git-hooks | 2.13.1  | Git hook manager (pre-commit)          |
| lint-staged      | 17.0.8  | Run linters/formatters on staged files |

Pre-commit hook runs: `oxlint` → `oxfmt --check` → `tsc --noEmit` on every commit.

### Authentication

| Technology                   | Version | Purpose                              |
| ---------------------------- | ------- | ------------------------------------ |
| better-auth                  | ^1.6.23 | Full auth system (DB sessions, RBAC) |
| @better-auth/drizzle-adapter | ^1.2.6  | Drizzle ORM adapter for Better Auth  |

### Deployment

| Technology                    | Notes                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- |
| TanStack Start (built-in SSR) | Dev server handles SSR internally via Vite environments                      |
| Nitro                         | Available for production builds                                             |
| bun                           | Runtime & package manager                                                    |

### Internationalization (i18n)

| Technology               | Version | Purpose                          |
| ------------------------ | ------- | -------------------------------- |
| i18next                  | v26.x   | Core i18n framework              |
| react-i18next            | v17.x   | React bindings for i18next       |
| i18next-browser-languagedetector | v8.x | Client-side language detection   |

**Structure:**
- `src/i18n/config.ts` — i18n instance factory with SSR support
- `src/i18n/provider.tsx` — `I18nProvider` component + `getServerSideI18n`
- `src/i18n/types.ts` — TypeScript type augmentation
- `src/i18n/locales/{en,id}/translation.json` — Translation files

**Language detection:** Cookie `i18next` → Accept-Language header → fallback `en`

**Usage:**
```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('navigation.dashboard')}</h1>;
}
```

## Error & loading states (per-route standard)

Every dashboard route must provide:

1. **Loading state** — `pendingComponent` on the route (or the router's
   `defaultPendingComponent` spinner is fine) and `<LoadingSkeleton />`
   (src/components/skeletons) for data lists.
2. **Error state** — the router-level `defaultErrorComponent` catches
   unhandled route errors. For routes needing a bespoke UI, use
   `errorComponent` on the route or wrap a section in
   `<ErrorBoundary fallback={...}>` from src/components/error-boundary.tsx.
3. **Reporting** — `ErrorBoundary.componentDidCatch` and `mapDbError` both
   report to Sentry (DSN-gated) and include `request_id` tags.

New routes MUST follow this pattern rather than inventing inline spinners
or `console.error` handlers.

## Known Cleanup (Selesai)

Items from the 2026-07-23 audit, all resolved:

| Category         | Finding                                                        | Status |
| ---------------- | -------------------------------------------------------------- | ------ |
| Dead code        | 9 unused component files + 1 unused hook                       | ✅      |
| Dead deps        | `react-responsive`, `match-sorter`, `sort-by`                  | ✅      |
| Duplicate auth   | V1 and V2 auth routes                                          | ✅      |
| Duplicate Radix  | `radix-ui` umbrella vs individual `@radix-ui/react-*`          | ✅      |
| Duplicate hooks  | `useMediaQuery` vs `useIsMobile`                               | ✅      |
| Font bug         | 3 fonts installed but not imported                             | ✅      |
| File size        | `kanban.tsx` (1021 lines)                                      | ✅      |
| Wrong dir        | `demo-form.tsx` di `components/forms/`                         | ✅      |
| IDOR             | Notifications not owner-scoped                                 | ✅      |
| Font unused      | `playfair-display`, `merriweather` not referenced by any theme | ✅      |
| Lazy-load        | 11 fonts loaded upfront, only 1-2 active per theme             | ✅      |

## External integrations

Integration adapters live in `src/integrations/` and follow a layered pattern:

```
src/integrations/
├── tripay/           # Tripay payment gateway
│   ├── client.ts     # HTTP client with auth
│   ├── types.ts      # Request/response types
│   ├── mapper.ts     # Status mapping
│   ├── service.ts    # Business logic
│   └── webhook.ts    # Signature verification + webhook handling
├── mikrotik/         # MikroTik RouterOS API
│   ├── client.ts
│   ├── types.ts
│   └── service.ts
└── shared/
    ├── http-client.ts
    └── integration-errors.ts
```

- **Tripay**: Webhook handler at `src/routes/api/v1/payments/webhook.ts` with HMAC signature verification
- **MikroTik**: PPPoE user management (scaffolding)
- **Payment schema**: `payments` table tracks external transactions with idempotency
- **Environment**: API keys stored in `process.env` (never in code or frontend)

## File uploads (pattern)

Uploads are validated with `validateUpload` (`src/lib/uploads.ts`) — a
`DomainError('UPLOAD_INVALID')` is thrown for disallowed mime types or
oversized files. Client-side accept/maxSize (react-dropzone) is UX only;
server validation is the security boundary.
