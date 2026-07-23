<p align="center">
  <img src="/public/tanstack-dashboard.png" alt="TanStack Start Dashboard Cover" style="max-width: 100%; border-radius: 8px;" />
</p>

<p align="center">
  <a href="https://github.com/togeziro/tanstack-dash/stargazers"><img src="https://img.shields.io/github/stars/togeziro/tanstack-dash?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/togeziro/tanstack-dash/network/members"><img src="https://img.shields.io/github/forks/togeziro/tanstack-dash?style=social" alt="Forks" /></a>
  <a href="https://github.com/togeziro/tanstack-dash/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/TanStack_Start-1.x-FF4154" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite" />
</p>

# TanStack Start Admin Dashboard

A production-ready **admin dashboard starter** built with **TanStack Start** (React 19 + Vite 7 + Nitro), **shadcn/ui**, **Tailwind CSS v4**, **Better Auth**, and **PostgreSQL (Drizzle ORM)**. It gives you charts, tables, forms, a kanban board, and a notification center behind a type-safe, feature-based codebase — ideal for SaaS apps, internal tools, and admin panels.

## Tech Stack

| Layer                                                                                                                                                          | Technology                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="https://avatars.githubusercontent.com/u/72518640?s=48&v=4" width="16" height="16" align="absmiddle" alt="TanStack" /> Frontend (UI)                  | [React 19](https://react.dev), [TanStack Router](https://tanstack.com/router) (file-based, type-safe), [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev), [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS v4](https://tailwindcss.com), [Recharts](https://recharts.org), [motion](https://motion.dev), [kbar](https://kbar.vercel.app/)                                                    |
| <img src="https://avatars.githubusercontent.com/u/72518640?s=48&v=4" width="16" height="16" align="absmiddle" alt="TanStack" /> Middle (server runtime & data) | [TanStack Start](https://tanstack.com/start) on [Vite 7](https://vite.dev) + [Nitro](https://nitro.build), [TanStack React Query](https://tanstack.com/query) with SSR dehydration via `@tanstack/react-router-ssr-query`, `createServerFn()` RPC boundary, server-side prefetch via route `loader` + `ensureQueryData({ ssr: 'data-only' })`, [Better Auth](https://better-auth.com) session + RBAC middleware |
| <img src="https://avatars.githubusercontent.com/u/82585676?s=48&v=4" width="16" height="16" align="absmiddle" alt="PostgreSQL" /> Backend (data & persistence) | [PostgreSQL](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team) (`postgres` driver), Better Auth DB-session store, server-only data-access layer with Zod-validated inputs and mapped DB errors, Nitro deploy presets (Vercel / Cloudflare / Node.js)                                                                                                                                        |

## Full-Stack Architecture

The app is organized as three cooperating tiers so each concern stays isolated:

### <img src="https://avatars.githubusercontent.com/u/72518640?s=48&v=4" width="16" height="16" align="absmiddle" alt="TanStack" /> Frontend — what the browser runs

- <img src="https://avatars.githubusercontent.com/u/6412038?s=48&v=4" width="16" height="16" align="absmiddle" alt="React" /> **React 19** components, server-rendered by TanStack Start and hydrated on the client.
- <img src="https://avatars.githubusercontent.com/u/72518640?s=48&v=4" width="16" height="16" align="absmiddle" alt="TanStack" /> **TanStack Router** file-based routes with fully type-safe params and search state.
- <img src="https://avatars.githubusercontent.com/u/72518640?s=48&v=4" width="16" height="16" align="absmiddle" alt="TanStack" /> **TanStack Form + Zod** for all forms (basic, multi-step, sheet/dialog, advanced).
- <img src="https://avatars.githubusercontent.com/u/139895814?s=48&v=4" width="16" height="16" align="absmiddle" alt="shadcn/ui" /> **shadcn/ui + Tailwind CSS v4** for the component layer and theming (10+ themes via `tweakcn`).
- <img src="https://avatars.githubusercontent.com/u/72518640?s=48&v=4" width="16" height="16" align="absmiddle" alt="TanStack" /> **TanStack Table** for sortable/filterable/paginated data tables driven by URL search params.
- <img src="https://avatars.githubusercontent.com/u/102815355?s=48&v=4" width="16" height="16" align="absmiddle" alt="Recharts" /> **Recharts** for the analytics overview; <img src="https://avatars.githubusercontent.com/u/114124786?s=48&v=4" width="16" height="16" align="absmiddle" alt="kbar" /> **kbar** for the Cmd+K command palette.

### <img src="https://avatars.githubusercontent.com/u/72518640?s=48&v=4" width="16" height="16" align="absmiddle" alt="TanStack" /> Middle — server runtime & data glue

- <img src="https://avatars.githubusercontent.com/u/72518640?s=48&v=4" width="16" height="16" align="absmiddle" alt="TanStack" /> **TanStack Start** (Vite 7 → Nitro) renders on the server and streams HTML. React Query cache is dehydrated into the page and rehydrated on the client via `setupRouterSsrQueryIntegration({ router, queryClient })`.
- **Route `loader`s** call `queryClient.ensureQueryData(...)` with `ssr: 'data-only'`, so data prefetches on the server and the client never refetches on first paint.
- **`createServerFn()`** is the RPC boundary for all server logic (products, users, kanban, notifications). Every endpoint enforces a valid session (`requireSession()`) or admin role (`requireRole('admin')`) **inside the handler**, so it cannot be reached unauthenticated over HTTP — independent of route guards.
- <img src="https://avatars.githubusercontent.com/u/139895814?s=48&v=4" width="16" height="16" align="absmiddle" alt="Better Auth" /> **Better Auth** provides the DB-session auth and `admin` plugin for RBAC; the `/api/auth/$` splat route handles all auth requests.

### <img src="https://avatars.githubusercontent.com/u/82585676?s=48&v=4" width="16" height="16" align="absmiddle" alt="PostgreSQL" /> Backend — data & persistence

- <img src="https://avatars.githubusercontent.com/u/82585676?s=48&v=4" width="16" height="16" align="absmiddle" alt="PostgreSQL" /> **PostgreSQL + Drizzle ORM** (<img src="https://avatars.githubusercontent.com/u/83924520?s=48&v=4" width="16" height="16" align="absmiddle" alt="Drizzle" /> `postgres` driver, server-only) is the source of truth for products, users, kanban, and notifications.
- **Better Auth schema** (`user`, `session`, `account`, `verification`) lives in the same Drizzle layer.
- **Server-only data-access modules** (`src/lib/db/`) dynamically `import()` the DB so the driver never reaches the client bundle. Inputs are Zod-validated at runtime; DB errors are mapped to safe messages (no column/constraint leakage).
- **Nitro** builds the app to any target (Vercel, Cloudflare Pages, Netlify, Node.js server).

## Features

- **Admin dashboard layout** (sidebar, header, content area)
- **Analytics overview** page with cards and Suspense-based independent loading
- **Data tables** with React Query route loaders, client-side cache, search, filter & pagination
- **Type-safe file-based routing** with TanStack Router (auto-generated route tree)
- **Server functions** via `createServerFn()` for server-side logic
- **Infobar component** to show helpful tips, status messages, or contextual info on any page
- **shadcn/ui components** with Tailwind CSS styling
- **Multi-theme support** with 10+ beautiful themes and easy theme switching
- **Feature-based folder structure** for scalable projects
- **Kanban board** with drag-n-drop (dnd-kit + PostgreSQL via Drizzle ORM)
- **Notification center** with bell icon badge, popover preview, and full page view (PostgreSQL-backed via Drizzle + React Query)
- **Command palette** (Cmd+K) for quick navigation
- **Better Auth** — DB-session auth with an `admin` role plugin, hardened RPC boundary (session + Zod + mapped errors)
- **Testing** — Vitest unit/integration tests + Playwright E2E tests for product CRUD and table sorting
- **Deploy via Nitro presets** — default Bun server build; Vercel/Cloudflare/Netlify configurable

## Pages

| Page                                          | Description                                                                                                                                   |
| :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| [Dashboard Overview](/dashboard/overview)     | Cards with Recharts graphs. Suspense boundaries for independent loading/error per section.                                                    |
| [Product List (Table)](/dashboard/product)    | TanStack Table + React Query (route loader prefetch + client cache) with URL search params for search, filter, pagination.                    |
| [Create Product Form](/dashboard/product/new) | TanStack Form + Zod with `useMutation` for create/update. Cache invalidation on success.                                                      |
| [Users (Table)](/dashboard/users)             | Users table with React Query + URL state pattern. Same architecture as Products.                                                              |
| [React Query Demo](/dashboard/react-query)    | Pokemon API showcase demonstrating route loader + `useSuspenseQuery` pattern with client-side cache.                                          |
| [Kanban Board](/dashboard/kanban)             | Drag n Drop task management board with dnd-kit, PostgreSQL-backed via Drizzle + React Query. Column sorting, task cards with priority badges. |
| [Notifications](/dashboard/notifications)     | Notification center with bell icon badge, popover preview, and dedicated full page with tabs.                                                 |
| [Forms](/dashboard/forms/basic)               | Basic, Multi-step, Sheet/Dialog, and Advanced form patterns with TanStack Form + Zod.                                                         |
| [Not Found](/notfound)                        | Custom 404 page via TanStack Router's `defaultNotFoundComponent`.                                                                             |

## Feature-based Organization

```plaintext
src/
├── routes/                        # TanStack Router file-based routes
│   ├── __root.tsx                 # Root layout (providers, theme, HTML shell)
│   ├── index.tsx                  # Home (auth redirect)
│   ├── auth/                      # Auth pages (sign-in, sign-up)
│   ├── dashboard.tsx              # Dashboard layout (sidebar, header, kbar)
│   └── dashboard/                 # Dashboard pages
│       ├── overview.tsx           # Analytics with Suspense boundaries
│       ├── product/               # Product CRUD (route loaders + React Query)
│       ├── users.tsx              # Users table (route loaders + React Query)
│       ├── react-query.tsx        # React Query demo page
│       ├── kanban.tsx             # Task board page
│       ├── notifications.tsx      # Notifications page
│       ├── forms/                 # Form examples
│       └── elements/              # UI showcase
│
├── components/                    # Shared components
│   ├── ui/                        # UI primitives (buttons, inputs, kanban, etc.)
│   ├── layout/                    # Layout components (header, sidebar, etc.)
│   ├── themes/                    # Theme system (selector, mode toggle, config)
│   └── kbar/                      # Command+K interface
│
├── features/                      # Feature-based modules
│   ├── overview/                  # Dashboard analytics (charts, cards)
│   ├── products/                  # Product listing, form, tables (React Query)
│   ├── users/                     # User management table (React Query)
│   ├── react-query-demo/          # React Query demo (Pokemon API)
│   ├── kanban/                    # Drag-drop task board
│   ├── notifications/             # Notification center (React Query + PostgreSQL)
│   ├── auth/                      # Auth components
│   └── forms/                     # Form showcases
│
├── lib/                           # Core utilities (query-client, parsers, etc.)
│   ├── auth/                     # Better Auth client + server config + permissions
│   └── db/                        # Drizzle ORM connection, schema, server-only data access
├── hooks/                         # Custom hooks (use-data-table, use-media-query, etc.)
├── config/                        # Navigation, infobar, data table config
├── constants/                     # Option constants, seed patterns & faker fallbacks
├── styles/                        # Global CSS & theme files
│   └── themes/                    # Individual theme CSS files (OKLCH)
└── types/                         # TypeScript types
```

## Getting Started

> This admin dashboard starter uses **TanStack Start** with **React 19**, **Vite 7**, **Better Auth**, **PostgreSQL + Drizzle**, and **shadcn/ui**. Follow these steps to run it locally:

Clone the repo:

```bash
git clone git@github.com:togeziro/tanstack-dash.git
cd tanstack-dash
```

Install dependencies and run:

```bash
bun install
bun run prepare     # activate pre-commit hooks
cp env.example.txt .env
```

Set up and seed the PostgreSQL database (ensure you have PostgreSQL running locally):

```bash
bun run db:push    # apply the Drizzle schema to the database
bun run db:seed     # seed products, kanban board, notifications, and a demo admin user
```

Run the development server:

```bash
bun run dev
```

You should now be able to access the application at http://localhost:3000.

Log in with the seeded demo account: **`admin@example.com`** / **`Password123!`** (Better Auth `admin` role).

### Testing

```bash
bun run test:run       # Vitest unit/integration tests
bun run e2e            # Playwright E2E tests (auto-starts dev server)
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
// Cloudflare Pages
nitro({ preset: 'cloudflare-pages' });

// Node.js server
nitro({ preset: 'node-server' });

// Netlify
nitro({ preset: 'netlify' });

// Vercel
nitro({ preset: 'vercel' });
```

Then run locally with:

```bash
bun run build
bun run start
```

> **Note:** Vercel/Cloudflare/Netlify presets are supported by Nitro but are not the default build target. The maintained, tested path is the `bun` preset.

## Security

The server-function RPC boundary is hardened at every endpoint:

- **Authentication**: every `createServerFn` handler calls `requireSession()` (or `requireRole('admin')` for product/user writes) — enforcement is at the handler level, independent of route guards.
- **Input validation**: every endpoint validates input at runtime with a Zod schema via `@tanstack/zod-adapter`.
- **Error mapping**: DB errors are wrapped by `mapDbError` — intentional domain errors pass through as `DomainError`; unexpected errors become generic messages (no column/constraint names leak).
- **Notifications IDOR** (resolved): all notification queries are scoped by `user_id`.

## Key Differences from upstream (Kiranism fork → ours)

| Concept       | Upstream (Next.js roots)                | This fork (TanStack Start)                                                                                                          |
| ------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | Next.js App Router                      | **TanStack Start** (React 19 + Vite 7 + Nitro)                                                                                      |
| Auth          | Next.js patterns                        | **Better Auth** (DB sessions, `admin` RBAC)                                                                                         |
| Database      | (template default)                      | **PostgreSQL + Drizzle ORM**                                                                                                        |
| Routing       | `app/`                                  | File-based (`routes/`) with type-safe params                                                                                        |
| Data Fetching | Server Components + `HydrationBoundary` | Route `loader` (`ensureQueryData`) dehydrated via `@tanstack/react-router-ssr-query`, consumed with `useQuery` / `useSuspenseQuery` |
| Layouts       | `layout.tsx` nesting                    | Layout routes with `<Outlet />`                                                                                                     |
| Server Code   | `'use server'` actions                  | `createServerFn()`                                                                                                                  |
| Build Tool    | Webpack/Turbopack                       | Vite                                                                                                                                |
| Deployment    | `next start`                            | Nitro (any platform)                                                                                                                |
| URL State     | nuqs                                    | TanStack Router `useSearch()` + `validateSearch`                                                                                    |

Cheers!

---

<p align="center">
  <sub>Forked from <a href="https://github.com/Kiranism/tanstack-start-dashboard">Kiranism/tanstack-start-dashboard</a>. Maintained fork with Better Auth + PostgreSQL backend and a hardened, tested codebase.</sub>
</p>

<!--
SEO keywords:

tanstack start dashboard, tanstack start admin template, vite dashboard template,
shadcn ui dashboard, admin dashboard starter, tanstack router, typescript dashboard,
dashboard ui template, react admin dashboard, tailwind css admin dashboard,
tanstack start shadcn admin panel, better auth dashboard, drizzle orm postgresql dashboard
-->
