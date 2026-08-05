# TanStack Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade TanStack packages, add CSRF + global request-id middleware, consolidate devtools, and remove kbar entirely.

**Architecture:** Bump 5 TanStack packages to their latest patch (Start 1.168.35, Router 1.170.18, Query 5.101.4, Form 1.33.3, Router-Plugin 1.168.23) and add `@tanstack/react-devtools`. Wire `createCsrfMiddleware` + a new `requestIdMiddleware` into `src/start.ts` `requestMiddleware`, then strip the now-redundant `withRequestContext` wrappers from every `*/api/service.ts`. Replace the two standalone devtools renders in `__root.tsx` with one centralized `TanStackDevtools` panel. Delete kbar (dependency, `src/components/kbar/`, `search-input.tsx`, wrappers in `dashboard.tsx` and `header.tsx`).

**Tech Stack:** TanStack Start/React Router/Query (bun + vite), React 19, vitest, oxlint, tsc.

## Global Constraints

- Package versions must match exactly: `@tanstack/react-start@^1.168.35`, `@tanstack/react-router@^1.170.18`, `@tanstack/react-query@^5.101.4`, `@tanstack/react-form@^1.33.3`, `@tanstack/router-plugin@^1.168.23`, `@tanstack/react-devtools@^0.10.9`.
- `rate-limiter-flexible` is KEPT (server-side per-user rate limiting). TanStack Pacer is NOT added.
- `@tanstack/react-query-devtools` and `@tanstack/react-router-devtools` are KEPT (required as panel renders for the centralized devtools).
- `cmdk`, `motion`, `pdf-lib`, `xlsx` are KEPT (used by other features).
- Do NOT commit unless a task says to commit.
- Codebase comments and identifiers stay English; only `src/i18n/locales/{en,id}/translation.json` values are Indonesian.
- Run `bun run typecheck`, `bun run lint`, and `bun run test:run` before each commit that changes code.

---

### Task 1: Bump TanStack package versions and add react-devtools

**Files:**
- Modify: `package.json` (dependencies + devDependencies)

**Interfaces:**
- Consumes: none
- Produces: updated `bun.lock` (via `bun install`) — later tasks rely on the newer packages being installed.

- [ ] **Step 1: Edit package.json version ranges**

In `dependencies`, change:
- `"@tanstack/react-form": "^1.33.0"` → `"@tanstack/react-form": "^1.33.3"`
- `"@tanstack/react-query": "^5.101.2"` → `"@tanstack/react-query": "^5.101.4"`
- `"@tanstack/react-router": "^1.170.17"` → `"@tanstack/react-router": "^1.170.18"`
- `"@tanstack/react-start": "^1.168.27"` → `"@tanstack/react-start": "^1.168.35"`
- `"@tanstack/router-plugin": "^1.168.19"` → `"@tanstack/router-plugin": "^1.168.23"`

In `devDependencies`, change:
- `"@tanstack/react-query-devtools": "^5.101.2"` → `"@tanstack/react-query-devtools": "^5.101.4"`

Add to `dependencies` (alphabetical, near the other `@tanstack/react-*`):
- `"@tanstack/react-devtools": "^0.10.9"`

- [ ] **Step 2: Install and verify**

```bash
bun install
bun run typecheck
bun run test:run
```

Expected: install succeeds, typecheck passes, all tests pass (465+).

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: bump TanStack packages and add react-devtools"
```

---

### Task 2: Add CSRF + request-id middleware via src/start.ts

**Files:**
- Create: `src/lib/server-middleware.ts`
- Modify: `src/start.ts`
- Test: `src/lib/server-middleware.test.ts`

**Interfaces:**
- Consumes: `createMiddleware` from `@tanstack/react-start`; `getRequestHeaders`/`setResponseHeader` from `@tanstack/react-start/server`; `createCsrfMiddleware` from `@tanstack/react-start`.
- Produces: `requestIdMiddleware` (a request middleware); registered in `startInstance` `requestMiddleware`. Later tasks rely on `x-request-id` being set globally for server fns.

- [ ] **Step 1: Write the failing test**

Create `src/lib/server-middleware.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockHeaders = vi.hoisted(() => new Map<string, string>());

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => ({ get: (name: string) => mockHeaders.get(name) ?? null }),
  getResponseHeaders: () => ({ get: (name: string) => mockHeaders.get(name) }),
  setResponseHeader: (name: string, value: string) => {
    mockHeaders.set(name, value);
  }
}));

import { requestIdMiddleware } from './server-middleware';

async function runMiddleware(overrides: Record<string, unknown> = {}) {
  const next = vi.fn(async (opts?: { context?: unknown }) => ({ context: opts?.context }));
  const ctx = {
    request: new Request('http://localhost:3000/rpc'),
    pathname: '/rpc',
    context: {},
    handlerType: 'serverFn',
    next,
    ...overrides
  };
  await (requestIdMiddleware as unknown as { options: { server?: (c: unknown) => unknown } }).options.server?.(ctx);
  return next;
}

describe('requestIdMiddleware', () => {
  afterEach(() => mockHeaders.clear());

  it('sets x-request-id on the response when none is supplied', async () => {
    await runMiddleware();
    expect(mockHeaders.get('x-request-id')).toBeTruthy();
  });

  it('echoes an incoming x-request-id header', async () => {
    mockHeaders.set('x-request-id', 'incoming-id-1');
    await runMiddleware();
    expect(mockHeaders.get('x-request-id')).toBe('incoming-id-1');
  });

  it('passes through non-serverFn requests without setting the header', async () => {
    await runMiddleware({ handlerType: 'router' });
    expect(mockHeaders.get('x-request-id')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:run src/lib/server-middleware.test.ts`
Expected: FAIL — module `./server-middleware` cannot be resolved / `requestIdMiddleware` undefined.

- [ ] **Step 3: Create src/lib/server-middleware.ts**

```ts
import { createMiddleware } from '@tanstack/react-start';

export const requestIdMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  if (handlerType !== 'serverFn') return next();

  let incoming: string | null = null;
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server');
    incoming = getRequestHeaders().get('x-request-id');
  } catch {
    // Not running inside a request — generate a fresh id below.
  }

  const requestId = incoming ?? globalThis.crypto.randomUUID();

  try {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('x-request-id', requestId);
  } catch {
    // No response object available; the id is still tracked for the handler.
  }

  return next();
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:run src/lib/server-middleware.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire middleware + CSRF into src/start.ts**

Replace the entire contents of `src/start.ts`:

```ts
import { createStart, createCsrfMiddleware } from '@tanstack/react-start';
import { initSentry } from './lib/sentry';
import { requestIdMiddleware } from './lib/server-middleware';

export const startInstance = createStart(() => {
  initSentry();
  return {
    requestMiddleware: [
      createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' }),
      requestIdMiddleware
    ]
  };
});
```

- [ ] **Step 6: Run full verification**

```bash
bun run typecheck
bun run test:run
bun run build
```

Expected: typecheck passes, all tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/start.ts src/lib/server-middleware.ts src/lib/server-middleware.test.ts
git commit -m "feat: add CSRF and request-id middleware to start server"
```

---

### Task 3: Remove withRequestContext wrappers from all server fn services

**Files:**
- Modify (each: remove the `withRequestContext` import and unwrap the `.handler` bodies):
  - `src/features/attendance/api/service.ts`
  - `src/features/audit/api/service.ts`
  - `src/features/customers/api/service.ts`
  - `src/features/employees/api/service.ts`
  - `src/features/masterdata/api/service.ts`
  - `src/features/notifications/api/service.ts`
  - `src/features/role-groups/api/current-user.ts`
  - `src/features/role-groups/api/service.ts`
  - `src/features/tasks/api/service.ts`
  - `src/features/users/api/service.ts`
- Modify: `src/lib/request-id.ts` (keep `withRequestContext`; add a JSDoc note that it is now only for non-request contexts — no code change required)

**Interfaces:**
- Consumes: the `requestIdMiddleware` from Task 2 (now sets `x-request-id` globally for server fns).
- Produces: no runtime behavior change — server fns still get `x-request-id`. `getRequestId()`/`withRequestContext` in `src/lib/request-id.ts` remain for tests and non-request contexts.

The transform pattern (applied to every server fn in these files):

```ts
// BEFORE
.handler(async ({ data }) =>
  withRequestContext(async () => {
    // ... body
  })
);

// AFTER
.handler(async ({ data }) => {
  // ... body (unchanged, one indent level left)
});
```

- [ ] **Step 1: Transform attendance/api/service.ts**

Edit `src/features/attendance/api/service.ts`:
1. Delete line `import { withRequestContext } from '@/lib/request-id';`.
2. For each `.handler(...)` whose body is `withRequestContext(async () => {...})`, unwrap it to a block body. Every occurrence in this file uses exactly this pattern (27 occurrences — verify none is nested differently). Preserve the inner body verbatim; just remove the `withRequestContext(async () =>` wrapper and the closing `)` / `)` at the end.

The result for the first handler (`checkInFn`) must be:

```ts
export const checkInFn = createServerFn({ method: 'POST' })
  .validator(attendanceCheckInSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('attendance', 'view');
    await checkRateLimit(`write:${session.user.id}`);
    const { checkIn } = await import('@/lib/db/attendance');
    const shift = await checkIn(session.user.id, data);
    await withAudit(
      session.user.id,
      {
        action: 'attendance.checkin',
        entityType: 'attendance',
        entityId: session.user.id,
        before: null,
        after: shift
      },
      async () => undefined
    );
    return shift;
  });
```

- [ ] **Step 2: Transform the remaining 9 files**

Repeat the same transform in:
- `src/features/audit/api/service.ts` (2 occurrences)
- `src/features/customers/api/service.ts` (6)
- `src/features/employees/api/service.ts` (6)
- `src/features/masterdata/api/service.ts` (10)
- `src/features/notifications/api/service.ts` (6)
- `src/features/role-groups/api/current-user.ts` (1)
- `src/features/role-groups/api/service.ts` (6)
- `src/features/tasks/api/service.ts` (6)
- `src/features/users/api/service.ts` (5)

For each file: delete the `withRequestContext` import line and unwrap every handler body. For `current-user.ts`, the result must be:

```ts
import { createServerFn } from '@tanstack/react-start';
import { requireSession } from '@/lib/auth/session';
import type { RoleGroup } from '@/features/role-groups/api/types';

export const getCurrentUserRoleGroupFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireSession();
  const { getUserRoleGroup } = await import('@/lib/db/role-groups');
  return getUserRoleGroup(session.user.id);
});
```

- [ ] **Step 3: Run full verification**

```bash
bun run typecheck
bun run lint
bun run test:run
```

Expected: typecheck passes, oxlint passes, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features
git commit -m "refactor: use global request middleware instead of per-fn withRequestContext"
```

---

### Task 4: Consolidate devtools into centralized TanStack Devtools

**Files:**
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes: `@tanstack/react-devtools` (added in Task 1), `@tanstack/react-query-devtools`'s `ReactQueryDevtoolsPanel`, `@tanstack/react-router-devtools`'s `TanStackRouterDevtoolsPanel`.
- Produces: single devtools entry in the root layout; no other task depends on it.

- [ ] **Step 1: Update imports in __root.tsx**

In `src/routes/__root.tsx`, replace the two import lines (lines 3-4):

```ts
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
```

with:

```ts
import { TanStackDevtools } from '@tanstack/react-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
```

- [ ] **Step 2: Replace the two devtools render sites**

In the JSX body (currently lines 124-125):

```tsx
        <TanStackRouterDevtools position='bottom-left' />
        <ReactQueryDevtools initialIsOpen={false} buttonPosition='bottom-right' />
```

replace with:

```tsx
        <TanStackDevtools
          plugins={[
            { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> },
            { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> }
          ]}
        />
```

- [ ] **Step 3: Run verification**

```bash
bun run typecheck
bun run test:run
```

Expected: typecheck passes, tests pass (devtools render only in dev).

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: consolidate devtools into centralized TanStack Devtools panel"
```

---

### Task 5: Remove kbar entirely

**Files:**
- Modify: `package.json` (remove `kbar` dependency)
- Delete: `src/components/kbar/index.tsx`, `src/components/kbar/render-result.tsx`, `src/components/kbar/result-item.tsx`, `src/components/kbar/use-theme-switching.tsx`
- Delete: `src/components/search-input.tsx`
- Modify: `src/routes/dashboard.tsx` (remove `KBar` import + both `<KBar>` wrappers)
- Modify: `src/components/layout/header.tsx` (remove `SearchInput` import + JSX)

**Interfaces:**
- Consumes: nothing (kbar has no consumers after this task's removals).
- Produces: clean dashboard layout without command palette. Later tasks verify no dangling imports.

- [ ] **Step 1: Remove kbar dependency and the kbar component directory**

In `package.json`, delete the line:
```json
    "kbar": "^0.1.0-beta.48",
```

Delete the directory and the search-input component:

```bash
rm -rf src/components/kbar
rm src/components/search-input.tsx
```

- [ ] **Step 2: Remove KBar from dashboard.tsx**

In `src/routes/dashboard.tsx`:
1. Delete the import line: `import KBar from '@/components/kbar';`
2. The `DashboardLayout` function currently wraps both the mobile and desktop branches in `<KBar>`. Replace:

```tsx
  if (isMobile && isStaff) {
    return (
      <KBar>
        <MobileShell />
      </KBar>
    );
  }

  return (
    <KBar>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <InfobarProvider defaultOpen={false}>
            <Outlet />
            <InfoSidebar side='right' />
          </InfobarProvider>
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
```

with:

```tsx
  if (isMobile && isStaff) {
    return <MobileShell />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <InfobarProvider defaultOpen={false}>
          <Outlet />
          <InfoSidebar side='right' />
        </InfobarProvider>
      </SidebarInset>
    </SidebarProvider>
  );
```

- [ ] **Step 3: Remove SearchInput from header.tsx**

In `src/components/layout/header.tsx`:
1. Delete the import line: `import SearchInput from '../search-input';`
2. In the JSX, delete:

```tsx
        <div className='hidden md:flex'>
          <SearchInput />
        </div>
```

- [ ] **Step 4: Verify no dangling kbar references**

```bash
grep -rn "kbar\|KBar\|search-input\|SearchInput" src/ --include="*.ts" --include="*.tsx"
```

Expected: no matches.

- [ ] **Step 5: Install, verify, and lint**

```bash
bun install
bun run typecheck
bun run lint
bun run test:run
```

Expected: install succeeds, typecheck passes, oxlint passes, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove kbar command palette entirely"
```

---

### Task 6: Update CHANGELOG and run final build

**Files:**
- Modify: `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: documented release notes; final verification.

- [ ] **Step 1: Add CHANGELOG entries**

Under `## [Unreleased]`, add a section (topmost, before "### Attendance expansion"):

```markdown
### TanStack alignment

- **Dependencies** — bumped `@tanstack/react-start` to 1.168.35, `@tanstack/react-router` to 1.170.18, `@tanstack/react-query` to 5.101.4, `@tanstack/react-form` to 1.33.3, `@tanstack/router-plugin` to 1.168.23; added `@tanstack/react-devtools` (centralized devtools panel).
- **CSRF protection** — `createCsrfMiddleware` now guards all server functions via `requestMiddleware` in `src/start.ts` (previously skipped because a custom `src/start.ts` existed).
- **Request-id plumbing** — request-id is now set by a global `requestIdMiddleware` instead of a per-server-fn `withRequestContext` wrapper; all `*/api/service.ts` handlers were de-wrapped.
- **Devtools** — React Query and Router devtools consolidated into a single `TanStackDevtools` panel.
- **Removed** — `kbar` command palette (dependency, components, search input, layout wiring).
```

- [ ] **Step 2: Run final full verification**

```bash
bun run typecheck
bun run lint
bun run test:run
bun run build
```

Expected: everything passes; build produces `.output/`.

- [ ] **Step 3: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs: record TanStack alignment changes"
```
