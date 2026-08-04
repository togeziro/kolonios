# Design: TanStack Alignment — Upgrade, Add, Remove

Date: 2026-08-04

Status: Approved

## Purpose

Bring the project up to date with the latest TanStack Start (now RC), close a
security gap (missing CSRF protection on server functions), reduce
boilerplate via Start's global `requestMiddleware`, consolidate devtools into
the centralized panel, and remove the kbar command palette entirely.

## Scope summary

| Action | Item |
|--------|------|
| Upgrade | 5 TanStack packages to latest patch |
| Add | CSRF middleware for server functions |
| Add | Global `requestMiddleware` (request-id plumbing) |
| Add | Centralized TanStack Devtools panel |
| Remove | kbar entirely (deps, components, artifacts) |

Explicitly **not** done: TanStack Pacer (client-side only; rate limiting here
is server-side per-user and stays on `rate-limiter-flexible`), removing
`@tanstack/react-query-devtools` / `@tanstack/react-router-devtools` (the
centralized panel requires their panel components).

## 1. Upgrade

Bump to latest in `package.json`:

| Package | From | To |
|---------|------|-----|
| `@tanstack/react-start` | 1.168.27 | 1.168.35 |
| `@tanstack/react-router` | 1.170.17 | 1.170.18 |
| `@tanstack/react-query` | 5.101.2 | 5.101.4 |
| `@tanstack/react-form` | 1.33.0 | 1.33.3 |
| `@tanstack/router-plugin` | 1.168.19 | 1.168.23 |

Diff 1.168.27 → 1.168.35 is patch-level only (RSC bundle fixes, Rsbuild asset
URLs, ESLint 10 peer dep). No API changes to code in use.

## 2. Add CSRF middleware

`src/start.ts` currently returns `{}`. Per official docs, when `src/start.ts`
exists, `createCsrfMiddleware()` is **not** auto-installed and must be added
explicitly to `requestMiddleware`. All `createServerFn` calls currently run
without CSRF protection.

```ts
import { createStart, createCsrfMiddleware } from '@tanstack/react-start';
import { initSentry } from './lib/sentry';

export const startInstance = createStart(() => {
  initSentry();
  return {
    requestMiddleware: [
      createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })
    ]
  };
});
```

## 3. Global requestMiddleware refactor

Today every server fn wraps itself in `withRequestContext(async () => {...})`.
Create `src/lib/server-middleware.ts` with a `requestIdMiddleware` that sets
the `x-request-id` response header (reusing `getRequestHeaders`,
`setResponseHeader`, and the UUID fallback logic from `src/lib/request-id.ts`),
filtered to `handlerType === 'serverFn'`. Register it in
`src/start.ts` `requestMiddleware`.

Remove the `withRequestContext` wrapper from all `*/api/service.ts` server fns
(attendance, customers, employees, notifications, users, role-groups,
masterdata, audit, tasks).

Keep `withRequestContext` in `src/lib/request-id.ts` for non-request contexts
(tests, seed scripts) and backward compatibility.

`requirePermission` and `checkRateLimit` stay per-server-fn (they need
per-endpoint module/action/key context; not globalizable).

## 4. Add centralized TanStack Devtools

Add `@tanstack/react-devtools` (v0.10.9). In `src/routes/__root.tsx`, replace
the two standalone devtools render sites with a single `TanStackDevtools`
wrapping both panels as plugins:

```tsx
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

<TanStackDevtools
  plugins={[
    { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> },
    { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
  ]}
/>
```

The panel packages are retained (required as panel renders). Devtools remain
development-only.

## 5. Remove kbar entirely

- Remove `kbar` dependency from `package.json`.
- Delete `src/components/kbar/` (index, render-result, result-item,
  use-theme-switching).
- Delete `src/components/search-input.tsx` (depends on `useKBar`).
- Remove `<KBar>` wrapper (import + JSX) from `src/routes/dashboard.tsx`.
- Remove `SearchInput` (import + JSX) from `src/components/layout/header.tsx`.

Kept: `cmdk` (shadcn `ui/command.tsx`, separate from kbar), `motion`,
`pdf-lib`, `xlsx` — all still used by features. TanStack Hotkeys explicitly
deferred to a future decision.

## Error handling

CSRF: requests without a valid token are rejected by the framework middleware
before handler code runs. request-id middleware never throws; header
setting is wrapped in try/catch as today.

## Testing

- `bun install` after bump/add.
- `bun run typecheck` (tsc).
- `bun run lint` (oxlint + i18n enforcement).
- `bun run test:run` (existing suite, 465+ tests).
- `bun run build` (client + server bundles).
- Manual CSRF check: POST to a server fn without CSRF token must be rejected.
- Update `docs/CHANGELOG.md`.
