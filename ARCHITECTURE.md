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
│   └── dashboard/              # Dashboard pages
├── features/                   # Feature modules
│   ├── <name>/
│   │   ├── api/                # Types, server functions, queries, mutations
│   │   ├── components/         # Feature-specific components
│   │   └── utils/              # Feature-specific utilities & state
├── lib/
│   └── db/                     # Drizzle schema, migrations, data access
├── components/                 # Shared UI (shadcn/ui primitives)
├── hooks/                      # Custom hooks
├── config/                     # Navigation, infobar, data table config
└── styles/                     # Global CSS & theme files
```

## Key Patterns

- **Server functions**: `createServerFn()` with `import()` inside handlers
- **State management**: React Query for all server state (products, users, kanban, notifications)
- **DB access**: Server-only modules in `src/lib/db/`, never imported by client code
- **RPC boundary authz**: Every `createServerFn` endpoint enforces a valid session at the boundary (not just the route `beforeLoad`): `requireSession()` for reads/mutations, `requireRole('admin')` for product/user writes.
- **Input validation**: Every server-function input is validated at runtime with a Zod schema via `@tanstack/zod-adapter`.
- **Error mapping**: `lib/db/*.ts` functions are wrapped in `try/catch` using the shared `mapDbError`. Intentional domain errors throw `DomainError` (pass through); unexpected DB errors become a generic message.
- **Pre-commit hooks**: simple-git-hooks + lint-staged (oxlint, oxfmt --check, tsc --noEmit)
- **E2E testing**: Playwright tests in `e2e/` auto-start the dev server, run headless Chromium with a single worker (shared DB).

> **Kanban** is intentionally shared across all authenticated users.
> **Notifications** are owner-scoped by `user_id` (IDOR resolved 2026-07-23).

## Authentication Flow

Auth uses **Better Auth** (DB-session based) via the `admin` plugin for RBAC. See [API.md](./API.md) for full details.

1. Sign-in/sign-up forms call `authClient.signIn.email` / `authClient.signUp.email` directly
2. Better Auth manages session cookies via the `tanstackStartCookies` plugin
3. API handler at `/api/auth/$` handles all Better Auth requests (GET/POST)
4. Dashboard routes use `beforeLoad` guard — calls `auth.api.getSession({ headers })`, redirects to `/auth/sign-in` if unauthenticated
5. Sign-out via `authClient.signOut()` clears the session
6. RBAC is enforced via Better Auth `admin` plugin with `createAccessControl` roles

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
| sonner                   | v1.7.4   | Toast notifications             |
| input-otp                | v1.4.2   | OTP input                       |
| react-resizable-panels   | v2.1.9   | Resizable panels                |
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
| TanStack React Query | v5.101.2 | Server state (products, users, kanban, notifications) |

### Tables & Charts

| Technology     | Version | Purpose                                      |
| -------------- | ------- | -------------------------------------------- |
| TanStack Table | v8.21.3 | Data tables (sorting, filtering, pagination) |
| Recharts       | v2.15.4 | Charts (area, bar, pie)                      |
| date-fns       | v4.1.0  | Date formatting                              |

### Styling & Themes

| Technology        | Version | Purpose                            |
| ----------------- | ------- | ---------------------------------- |
| Tailwind CSS      | v4.2.2  | Utility-first CSS                  |
| @tailwindcss/vite | v4.2.2  | Tailwind Vite plugin               |
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

### Drag & Drop

| Technology         | Version | Purpose               |
| ------------------ | ------- | --------------------- |
| @dnd-kit/core      | v6.3.1  | Kanban drag-and-drop  |
| @dnd-kit/modifiers | v9.0.0  | Movement restrictions |
| @dnd-kit/sortable  | v10.0.0 | Sortable columns      |
| @dnd-kit/utilities | v3.2.2  | Drag utilities        |

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
| @faker-js/faker | v9.9.0  | Seed data generation |
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
| @testing-library/jest-dom   | v6.9.1  | DOM-specific matchers               |
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
