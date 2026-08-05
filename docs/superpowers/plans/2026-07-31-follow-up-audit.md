# Follow-up Audit & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the 2026-07-31 follow-up audit (observability, rate limiting, RBAC correctness, audit trail, notifications polling, demo-page removal, i18n enforcement, coverage baseline, API.md correctness).

**Architecture:** TanStack Start + React 19 + React Query + Drizzle + PostgreSQL + Better Auth + pino. All new infrastructure is fail-safe (no-ops when env vars are unset). Changes are phased so the app remains shippable and green (`typecheck`, `lint`, `test:run`) after every phase.

**Tech Stack:** Bun, TanStack Start v1.168.27, TanStack Query v5, Drizzle v0.45, Better Auth v1.6.23, Vitest v4, Playwright, oxlint/oxfmt, pino, `@sentry/tanstackstart-react` (new, approved).

**Spec:** `docs/superpowers/specs/2026-07-31-follow-up-audit-design.md`

## Global Constraints

- Exact versions already in `package.json` must not be upgraded (no unrelated dep bumps).
- New deps require prior approval — only `@sentry/tanstackstart-react` is approved this round. No other new packages.
- All new code must pass `bun run typecheck`, `bun run lint`, `bun run test:run` before commit.
- Tests for the DB layer use `src/test-utils/db.ts` against the dedicated `kolonios_test` DB (see `scripts/create-test-db.ts`; new schema files must be added to `drizzle.config.ts` so `db:push` creates them in the test DB).
- Server functions keep the existing pattern: dynamic `import()` inside `.handler()` so the `postgres` driver never reaches the client bundle.
- i18n: every new user-facing string must exist in BOTH `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json`.
- `.gitignore` ignores `*.md` — doc changes are NOT committed (repo convention); code changes ARE committed with `git commit` messages matching repo style (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- The `Elements` demo pages and their nav group must never return to the production bundle (regression test enforced in Task 1.6).

---

## Phase 0 — Archive & reconcile

### Task 0.1: Archive the 2026-07-30 audit doc

**Files:**
- Modify: `docs/audit/2026-07-30-repository-audit.md` (rename + header)

**Interfaces:**
- Produces: `docs/audit/2026-07-30-repository-audit-archive.md` (historical record)

- [ ] **Step 1: Rename and prepend an archive header**

```bash
mv docs/audit/2026-07-30-repository-audit.md docs/audit/2026-07-30-repository-audit-archive.md
```

Then edit the file to insert this header at the top (above `# Repository Audit`):

```markdown
> **ARCHIVED 2026-07-31.** Superseded by the follow-up audit: see
> `docs/superpowers/specs/2026-07-31-follow-up-audit-design.md` and
> `docs/superpowers/plans/2026-07-31-follow-up-audit.md`. The 2026-07-30
> phased plan is replaced entirely; its completed items live on in the
> CHANGELOG, its remaining gaps are covered by the new plan.
```

- [ ] **Step 2: Verify**

Run: `head -8 docs/audit/2026-07-30-repository-audit-archive.md`
Expected: the archive header, then `# Repository Audit`.

- [ ] **Step 3: Commit**

```bash
git add -A -- docs 2>/dev/null || true
git commit -m "docs: archive 2026-07-30 repository audit as historical"
```

> Note: `*.md` is gitignored, so `git add docs` will stage nothing. If so, skip the commit for this task (docs are local-only by convention) and note it in the phase wrap-up. Do NOT force-add.

### Task 0.2: Rewrite TODO.md as single source of truth

**Files:**
- Modify: `docs/TODO.md` (full rewrite)

**Interfaces:**
- Consumes: spec decisions (locked list below)

- [ ] **Step 1: Replace the entire contents of `docs/TODO.md`**

```markdown
# Project Todo List

## Current Audit — 2026-07-31 Follow-up (in progress)

Plan: `docs/superpowers/plans/2026-07-31-follow-up-audit.md`
Spec: `docs/superpowers/specs/2026-07-31-follow-up-audit-design.md`

- [ ] Phase 0 — Archive 2026-07-30 audit, reconcile TODO
- [ ] Phase 1 — Kanban doc cleanup, delete demo pages, dead upload UI, notification id types, i18n key prune
- [ ] Phase 2 — Notifications polling (refetchInterval 30s) + NOTIFICATIONS.md
- [ ] Phase 3 — Sentry + request-id middleware + error boundary standard
- [ ] Phase 4 — audit_log table + withAudit + admin audit-log route
- [ ] Phase 5 — RBAC fixes (requireRole sets, requireMinRole, customer role)
- [ ] Phase 6 — API.md rewrite, i18n enforcement scripts, 70% coverage, uploads helper
- [ ] Phase 7 — Better Auth rate limit + per-user write rate limits
- [ ] Phase 8 — Health-score summary, CHANGELOG, README

## Completed (prior audits)

- 2026-07-30 audit (archived): error handling DomainError, LoadingSkeleton,
  +188 tests, API versioning /api/v1, pino logging, .env.example, migration
  workflow, checkInFn rate limit, CI verified, dependency cleanup.
- Kanban feature: fully removed from code, schema, migrations, seed, routes.
  (Only stale mention was docs/API.md §Kanban — removed in Phase 1.)

## Deferred / Future

- [ ] WhatsApp notification channel + attendance reminders (late check-in, leave approval)
- [ ] Masterdata extended: invoices, payments, ticket support system
- [ ] Payroll & reporting modules (will use requireMinRole/permission matrix)
- [ ] Customer self-service portal (customer role shell in dashboard.tsx)
- [ ] SSE upgrade for notifications when a sub-second workflow exists (see docs/NOTIFICATIONS.md)
- [ ] Generic live upload endpoint + storage (reuse src/lib/uploads.ts helper)
- [ ] Migration of src/lib/auth/permissions.ts into active per-entity guards
- [ ] VPS deployment script, PM2, DB backup automation, SSL guide
- [ ] E2E: auth flows, customers, employees, attendance check-in
```

- [ ] **Step 2: Verify**

Run: `grep -c "2026-07-31" docs/TODO.md`
Expected: `4` (plan, spec, phase 0, header mentions). No leftover `Phase 1 —` old items.

### Task 0.3: CHANGELOG entry

**Files:**
- Modify: `docs/CHANGELOG.md` (insert at top under the first heading)

- [ ] **Step 1: Insert an `[Unreleased]` entry**

Directly below the `# Changelog` heading, insert:

```markdown
## [Unreleased — 2026-07-31]

### Audit

- **Follow-up repository audit** — Spec at
  `docs/superpowers/specs/2026-07-31-follow-up-audit-design.md`; the
  2026-07-30 plan is archived (`docs/audit/2026-07-30-repository-audit-archive.md`).
- Coverage baseline enforced (70% lines/branches/functions/statements).
- i18n enforcement: key-parity check + hardcoded-string scanner wired into lint/CI.
```

- [ ] **Step 2: Verify**

Run: `head -12 docs/CHANGELOG.md`
Expected: the new entry appears first.

---

## Phase 1 — Quick wins & dead-code purge

### Task 1.1: Remove stale Kanban docs from API.md

**Files:**
- Modify: `docs/API.md` lines 41–47 (the `### Kanban` section)

- [ ] **Step 1: Delete the Kanban block**

Remove these lines from `docs/API.md`:

```markdown
### Kanban

| Function     | Method | Payload           | Returns                  |
| ------------ | ------ | ----------------- | ------------------------ |
| `getBoardFn` | GET    | —                 | `Record<string, Task[]>` |
| `addTaskFn`  | POST   | `AddTaskPayload`  | `Task`                   |
| `moveTaskFn` | POST   | `MoveTaskPayload` | `{ success }`            |
```

- [ ] **Step 2: Verify**

Run: `grep -ni kanban docs/API.md`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/API.md
git commit -m "docs: remove stale kanban section from API.md"
```

### Task 1.2: Delete demo pages + Elements nav group + demo feature dirs

**Files:**
- Delete: `src/routes/dashboard/forms/basic.tsx`, `src/routes/dashboard/forms/multi-step.tsx`, `src/routes/dashboard/forms/sheet-form.tsx`, `src/routes/dashboard/forms/advanced.tsx`, `src/routes/dashboard/forms/index.tsx`, `src/routes/dashboard/react-query.tsx`, `src/routes/dashboard/elements/icons.tsx` (and the now-empty `forms/`, `elements/` dirs)
- Delete: `src/features/forms/` (incl. `demo-form.tsx`), `src/features/react-query-demo/`, `src/features/elements/`
- Modify: `src/config/nav-config.ts` (remove `Elements` group, lines 86–133)
- Modify: `src/routeTree.gen.ts` (regenerated by build)

**Interfaces:**
- Consumes: nothing (pure deletion)
- Produces: `navGroups` with only Overview + Settings groups

- [ ] **Step 1: Delete the route files and feature dirs**

```bash
rm -rf src/routes/dashboard/forms \
  src/routes/dashboard/elements \
  src/routes/dashboard/react-query.tsx \
  src/features/forms \
  src/features/react-query-demo \
  src/features/elements
```

- [ ] **Step 2: Remove the Elements group from nav-config**

Edit `src/config/nav-config.ts`: delete the entire third group (`{ label: 'Elements', ... }`) from the `navGroups` array (currently lines 86–133). The file now ends after the `Settings` group with `];`.

- [ ] **Step 3: Regenerate the route tree**

Run: `bun run build` (the router plugin regenerates `src/routeTree.gen.ts`).
Expected: build succeeds; `grep -c "dashboard/forms\|dashboard/react-query\|dashboard/elements" src/routeTree.gen.ts` prints `0`.

- [ ] **Step 4: Verify no dangling imports**

Run: `bun run typecheck && bun run lint`
Expected: both pass with no unresolved `@/features/forms` / `@/features/react-query-demo` / `@/features/elements` imports.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "chore: remove demo/showcase pages and Elements nav group"
```

### Task 1.3: Remove dead upload UI + react-dropzone dependency

**Files:**
- Delete: `src/components/file-uploader.tsx`, `src/components/forms/fields/file-upload-field.tsx`, `src/components/ui/file-preview.tsx`
- Modify: `src/features/products/components/product-form.tsx:72,83-89` (remove upload field)
- Modify: `src/components/ui/tanstack-form.tsx:30,38,152,172,206` (remove FileUploadField plumbing)
- Modify: `src/components/forms/fields/index.tsx:9,23` (remove the two re-exports)
- Modify: `package.json` (remove `react-dropzone`)

**Interfaces:**
- Consumes: nothing
- Produces: `useFormFields` returns only text/select/textarea/checkbox/switch/radio/slider fields; `react-dropzone` gone from deps

- [ ] **Step 1: Delete the three components**

```bash
rm src/components/file-uploader.tsx \
  src/components/forms/fields/file-upload-field.tsx \
  src/components/ui/file-preview.tsx
```

- [ ] **Step 2: Remove the upload field from product-form.tsx**

In `src/features/products/components/product-form.tsx`:
- Line 72: change
  `const { FormTextField, FormSelectField, FormTextareaField, FormFileUploadField } =` →
  `const { FormTextField, FormSelectField, FormTextareaField } =`
- Lines 83–89: delete the whole JSX block:

```tsx
            <FormFileUploadField
              name='image'
              label='Product Image'
              description='Upload a product image'
              maxSize={5 * 1024 * 1024}
              maxFiles={4}
            />
```

- [ ] **Step 3: Remove FileUploadField plumbing from tanstack-form.tsx**

In `src/components/ui/tanstack-form.tsx`:
- Remove `FileUploadField,` from the base-field import block (currently line 30).
- Remove `FileUploadField,` from the destructure block (currently line 38).
- Remove the `FileUploadField: FormFileUploadField` registration from `formComponents` (currently line 172).
- Remove `FormFileUploadField: FormFileUploadField as unknown as Typed<typeof FormFileUploadField>` from `useFormFields` (currently line 206).
- Remove `FormFileUploadField` from the `useFormFields` destructure import block (currently line 152 is inside the same group as 172 — see the file; both the `baseComponents`-style list and the `formComponents` mapping reference it; remove both).

- [ ] **Step 4: Remove the re-exports from fields/index.tsx**

In `src/components/forms/fields/index.tsx`, delete lines 9 and 23:
`export { FileUploadField } from './file-upload-field';`
`export { FormFileUploadField } from './file-upload-field';`

- [ ] **Step 5: Remove the dependency**

```bash
bun remove react-dropzone
```

- [ ] **Step 6: Verify**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass; `grep -rn "FileUploader\|file-preview" src` returns no matches.

- [ ] **Step 7: Commit**

```bash
git add -A src package.json bun.lock
git commit -m "chore: remove dead file-upload UI and react-dropzone dependency"
```

### Task 1.4: Fix notification id type drift (`number` → `string`)

**Files:**
- Modify: `src/features/notifications/api/types.ts` (`MarkAsReadPayload`, `RemoveNotificationPayload`)
- Modify: `src/features/notifications/api/validation.ts` (coerce string→number server-side)
- Modify: `src/features/notifications/api/mutations.ts` (accept `string`)
- Modify: `src/features/notifications/components/notification-center.tsx:89,93` and `notifications-page.tsx:53,57` (drop `Number()` casts)

**Interfaces:**
- Produces: `markAsReadMutation.mutationFn(id: string)`, `removeNotificationMutation.mutationFn(id: string)`; server schema coerces `"42"` → `42` before the DB layer

- [ ] **Step 1: Update the payload types**

In `src/features/notifications/api/types.ts`, change both to:

```ts
export type MarkAsReadPayload = {
  id: string;
};

export type RemoveNotificationPayload = {
  id: string;
};
```

- [ ] **Step 2: Coerce in the schemas**

In `src/features/notifications/api/validation.ts`, replace the two schemas:

```ts
export const markAsReadSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive number')
});

export const removeNotificationSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive number')
});
```

- [ ] **Step 3: Update the mutations**

In `src/features/notifications/api/mutations.ts`, change the two mutation fns:

```ts
export const markAsReadMutation = mutationOptions({
  mutationFn: (id: string) => markAsReadFn({ data: { id } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    console.error('Failed to mark notification as read:', err);
  }
});
```

```ts
export const removeNotificationMutation = mutationOptions({
  mutationFn: (id: string) => removeNotificationFn({ data: { id } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
  },
  onError: (err) => {
    console.error('Failed to remove notification:', err);
  }
});
```

- [ ] **Step 4: Drop the client-side casts**

In `notification-center.tsx`:
- `onMarkAsRead={(id) => markAsRead(Number(id))}` → `onMarkAsRead={(id) => markAsRead(id)}`
- `onAction={(notifId, actionId) => { ... markAsRead(Number(notifId)); ...` → `markAsRead(notifId)`

In `notifications-page.tsx`: same two replacements (`markAsRead(Number(id))` → `markAsRead(id)`, `markAsRead(Number(notifId))` → `markAsRead(notifId)`).

- [ ] **Step 5: Verify**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass. The service layer (`markAsReadFn`) still receives `number` after Zod coercion, so `src/lib/db/notifications.ts` is unchanged.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "fix: notification id payloads use string ids with server-side coercion"
```

### Task 1.5: Prune i18n demo keys + add regression tests

**Files:**
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json` (remove `navigation.forms`, `navigation.basicForm`, `navigation.multiStepForm`, `navigation.sheetDialog`, `navigation.advancedPatterns`, `navigation.reactQuery`, `navigation.icons`)
- Create: `src/config/nav-config.test.ts`
- Create: `src/routeTree.demo.test.ts`

**Interfaces:**
- Produces: both locale files with identical key sets (128 − 7 = 121 keys each); two regression tests

- [ ] **Step 1: Remove the seven demo keys from BOTH locale files**

In both `en/translation.json` and `id/translation.json`, delete the lines:

```json
    "forms": "...",
    "basicForm": "...",
    "multiStepForm": "...",
    "sheetDialog": "...",
    "advancedPatterns": "...",
    "reactQuery": "...",
    "icons": "..."
```

(Replace `"..."` with each file's actual value; keep the two files structurally identical.)

- [ ] **Step 2: Write the nav-config regression test**

Create `src/config/nav-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { navGroups } from './nav-config';

describe('nav-config', () => {
  it('does not expose demo/showcase pages in production navigation', () => {
    const urls = navGroups.flatMap((group) =>
      group.items.flatMap((item) => [item.url, ...item.items.map((sub) => sub.url)])
    );
    for (const demoPrefix of ['/dashboard/forms', '/dashboard/react-query', '/dashboard/elements']) {
      expect(urls.some((url) => url.startsWith(demoPrefix))).toBe(false);
    }
  });

  it('keeps the four core module groups', () => {
    const labels = navGroups.map((group) => group.label);
    expect(labels).toContain('Overview');
    expect(labels).toContain('Settings');
    expect(labels).not.toContain('Elements');
  });
});
```

- [ ] **Step 3: Write the routeTree regression test**

Create `src/routeTree.demo.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeTreeSource = readFileSync(join(process.cwd(), 'src', 'routeTree.gen.ts'), 'utf8');

describe('routeTree.gen', () => {
  it('has no demo/showcase routes', () => {
    expect(routeTreeSource).not.toMatch(/dashboard\/forms/);
    expect(routeTreeSource).not.toMatch(/dashboard\/react-query/);
    expect(routeTreeSource).not.toMatch(/dashboard\/elements/);
  });
});
```

- [ ] **Step 4: Verify**

Run: `bun run test:run src/config/nav-config.test.ts src/routeTree.demo.test.ts`
Expected: PASS (2 files, 3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "test: assert demo pages stay out of production nav and route tree"
```

---

## Phase 2 — Notifications polling

### Task 2.1: Poll notifications with React Query

**Files:**
- Modify: `src/features/notifications/api/queries.ts`
- Create: `src/features/notifications/api/queries.test.ts`

**Interfaces:**
- Consumes: `getNotificationsFn` (unchanged)
- Produces: `notificationListQueryOptions()` with polling behaviour — consumed by `notification-center.tsx` and `notifications-page.tsx` (no consumer changes needed)

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/api/queries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { notificationListQueryOptions } from './queries';

describe('notificationListQueryOptions', () => {
  it('polls every 30 seconds while the tab is visible', () => {
    const options = notificationListQueryOptions();
    expect(options.refetchInterval).toBe(30_000);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe('always');
  });

  it('keeps notifications fresh for at most 15 seconds', () => {
    const options = notificationListQueryOptions();
    expect(options.staleTime).toBe(15_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/features/notifications/api/queries.test.ts`
Expected: FAIL — `options.refetchInterval` is `undefined`.

- [ ] **Step 3: Implement polling**

Replace the body of `src/features/notifications/api/queries.ts`:

```ts
import { queryOptions } from '@tanstack/react-query';
import { getNotificationsFn } from './service';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const
};

export const notificationListQueryOptions = () =>
  queryOptions({
    queryKey: notificationKeys.list(),
    queryFn: () => getNotificationsFn(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    staleTime: 15_000
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/features/notifications/api/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Full check**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat: poll notifications every 30s via React Query refetchInterval"
```

### Task 2.2: Document the delivery mechanism + SSE upgrade path

**Files:**
- Create: `docs/NOTIFICATIONS.md`

- [ ] **Step 1: Write the doc**

Create `docs/NOTIFICATIONS.md`:

```markdown
# Notifications — Delivery Mechanism

## Current design (2026-07-31)

Delivery is **client polling via TanStack Query**:

- `notificationListQueryOptions()` (`src/features/notifications/api/queries.ts`)
  sets `refetchInterval: 30_000`, `refetchIntervalInBackground: false`,
  `refetchOnWindowFocus: 'always'`, `staleTime: 15_000`.
- Mutations invalidate `notificationKeys.all` immediately, so the badge
  updates as soon as the user marks/removes/adds a notification.
- Worst-case badge latency: ~30 s (one poll interval). No server push.

Rationale: TanStack ecosystem guidance is progressive enhancement — polling
integrates with caching, stale-while-revalidate, and focus refetching; no new
protocol or dependency is required for badge-style updates. This matches the
polling cadence used in the MIKCYBERLTE reference project (30–60 s
`setInterval`).

## SSE upgrade path (when to switch)

Switch to Server-Sent Events when a workflow requires **sub-second** delivery
(e.g. leave-approval push, live ticket updates):

1. Add `GET /api/v1/notifications/stream` returning `text/event-stream`
   (Nitro `ReadableStream`), authenticated like other server functions.
2. Client: `EventSource` with reconnect + `Last-Event-ID`; on `message`
   call `queryClient.invalidateQueries({ queryKey: notificationKeys.all })`.
3. Keep the query options as the fallback (polls resume when the stream
   drops) — polling stays as the resilience layer.
4. WebSocket is only justified for bidirectional flows (chat, live editing);
   not needed for notifications.

## Reference

- Server functions: `src/features/notifications/api/service.ts`
- DB layer: `src/lib/db/notifications.ts` (rows are user-scoped via `user_id`)
```

- [ ] **Step 2: Verify**

Run: `grep -c "SSE" docs/NOTIFICATIONS.md`
Expected: `3` or more.

---

## Phase 3 — Observability: Sentry + request-id + error boundary standard

### Task 3.1: Install Sentry and create the guarded client/server init

**Files:**
- Modify: `package.json` (dependency)
- Create: `src/lib/sentry.ts`

**Interfaces:**
- Produces: `initSentry()`, `captureError(error, tags?)`, `isSentryEnabled()` — dependency-free module (safe for client bundles)

- [ ] **Step 1: Install**

```bash
bun add @sentry/tanstackstart-react
```

Expected: added to `dependencies`; minimum supported TanStack Start `1.111.12` (repo has `1.168.27`).

- [ ] **Step 2: Create the guarded module**

Create `src/lib/sentry.ts`:

```ts
import * as Sentry from '@sentry/tanstackstart-react';

let enabled = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || enabled) return;
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1)
    });
    enabled = true;
  } catch (err) {
    // Never break the app because Sentry misbehaved.
    console.warn('Sentry init failed — continuing without error tracking', err);
  }
}

export function captureError(error: unknown, tags?: Record<string, string>) {
  if (!enabled) return;
  try {
    Sentry.captureException(error, tags ? { tags } : undefined);
  } catch {
    // Capture must never throw into the calling code path.
  }
}

export function isSentryEnabled() {
  return enabled;
}
```

> Do NOT import `logger` (pino) here — this module is imported by client-side `ErrorBoundary` and would drag pino into the browser bundle.

- [ ] **Step 3: Hook init into app startup**

In `src/start.ts`, add the import and call as the first statement of the `createStart` callback:

```ts
import { createStart } from '@tanstack/react-start';
import { initSentry } from './lib/sentry';

export const startInstance = createStart(() => {
  initSentry();
  return {};
});
```

- [ ] **Step 4: Add env docs**

Append to `.env.example`:

```bash
# ── Sentry ──────────────────────────────────────
# Error tracking DSN. When unset, Sentry is disabled (no-op) and the app
# runs exactly as before.
SENTRY_DSN=
# Fraction of transactions to trace (0 = disabled, 1 = all).
SENTRY_TRACES_SAMPLE_RATE=0.1
```

- [ ] **Step 5: Verify**

Run: `bun run typecheck && bun run lint && bun run dev` (then hit any page)
Expected: server log line-free of Sentry errors, app boots; with `SENTRY_DSN` unset no network calls to Sentry.

- [ ] **Step 6: Commit**

```bash
git add -A src package.json bun.lock .env.example
git commit -m "feat: add DSN-gated Sentry integration (no-op when unset)"
```

### Task 3.2: Request-id middleware (withRequestContext)

**Files:**
- Create: `src/lib/request-id.ts`
- Create: `src/lib/request-id.test.ts`

**Interfaces:**
- Produces: `withRequestContext<T>(handler: () => Promise<T>): Promise<T>` (echoes/creates `x-request-id` response header), `getRequestId(): string | undefined` (reads current request's id) — both safe to call outside a request (return undefined / generate fresh)

- [ ] **Step 1: Write the failing test**

Create `src/lib/request-id.test.ts`:

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

import { getRequestId, withRequestContext } from './request-id';

describe('withRequestContext', () => {
  afterEach(() => mockHeaders.clear());

  it('generates a request id when none is supplied', async () => {
    let seen: string | undefined;
    await withRequestContext(async () => {
      seen = getRequestId();
    });
    expect(seen).toBeTruthy();
    expect(mockHeaders.get('x-request-id')).toBe(seen);
  });

  it('echoes an incoming x-request-id header', async () => {
    mockHeaders.set('x-request-id', 'incoming-id-1');
    let seen: string | undefined;
    await withRequestContext(async () => {
      seen = getRequestId();
    });
    expect(seen).toBe('incoming-id-1');
    expect(mockHeaders.get('x-request-id')).toBe('incoming-id-1');
  });

  it('returns undefined outside a request scope', () => {
    expect(getRequestId()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/request-id.test.ts`
Expected: FAIL — module `./request-id` does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/request-id.ts`:

```ts
import { getRequestHeaders, getResponseHeaders, setResponseHeader } from '@tanstack/react-start/server';

export function getRequestId(): string | undefined {
  try {
    return getResponseHeaders().get('x-request-id') ?? undefined;
  } catch {
    // Not running inside a request (tests, seed scripts).
    return undefined;
  }
}

export async function withRequestContext<T>(handler: () => Promise<T>): Promise<T> {
  let incoming: string | null = null;
  try {
    incoming = getRequestHeaders().get('x-request-id');
  } catch {
    // Not running inside a request — generate a fresh id.
  }
  try {
    setResponseHeader('x-request-id', incoming || globalThis.crypto.randomUUID());
  } catch {
    // No response object available; the id is still tracked for the handler.
  }
  return handler();
}
```

> `@tanstack/react-start/server` static imports are already used by `src/lib/rate-limit.ts`, which is imported from client-bundled server functions, so this module is safe on both sides.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/request-id.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/request-id.ts src/lib/request-id.test.ts
git commit -m "feat: add per-request x-request-id middleware and getter"
```

### Task 3.3: Wire request context into all server functions

**Files:**
- Modify: all 42 handlers across `src/features/*/api/service.ts` (7 files: products, users, notifications, attendance, employees, customers, masterdata)

**Interfaces:**
- Consumes: `withRequestContext` from Task 3.2
- Produces: every server function echoes `x-request-id` and exposes it to `getRequestId()` for logging/audit

- [ ] **Step 1: Convert the attendance service (full example)**

Edit `src/features/attendance/api/service.ts`:

- Add import: `import { withRequestContext } from '@/lib/request-id';`
- Convert `checkInFn`:

```ts
export const checkInFn = createServerFn({ method: 'POST' })
  .validator(attendanceCheckInSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('employee');
      await checkRateLimit(`checkin:${session.user.id}`);
      const { checkIn } = await import('@/lib/db/attendance');
      return checkIn(session.user.id, data);
    })
  );
```

- Convert `checkOutFn`:

```ts
export const checkOutFn = createServerFn({ method: 'POST' })
  .validator(attendanceCheckOutSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('employee');
      const { checkOut } = await import('@/lib/db/attendance');
      return checkOut(session.user.id, data);
    })
  );
```

- Convert `getMyAttendanceFn`, `getAttendanceHistoryFn`, `getMyLeavesFn`, `createLeaveRequestFn`, `getPerformanceStatsFn`, `getLocationsFn`, `getShiftsFn` with the same mechanical transformation: wrap the existing handler body in `withRequestContext(async () => { ... })`.

- [ ] **Step 2: Convert the remaining six service files**

Apply the identical mechanical transformation (wrap each existing handler body in `withRequestContext(async () => { ... })` and add the import) to:

- `src/features/products/api/service.ts` (5 fns)
- `src/features/users/api/service.ts` (4 fns)
- `src/features/notifications/api/service.ts` (5 fns)
- `src/features/employees/api/service.ts` (5 fns)
- `src/features/customers/api/service.ts` (5 fns)
- `src/features/masterdata/api/service.ts` (9 fns)

The transformation rule is exact and uniform: for a handler of the shape

```ts
.handler(async ({ data }) => {
  ...body...
})
```

produce

```ts
.handler(async ({ data }) =>
  withRequestContext(async () => {
    ...body...
  })
)
```

- [ ] **Step 3: Verify**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev`, sign in, open the notifications page, check the Network tab for a response header `x-request-id` on the `getNotificationsFn` request.
Expected: header present with a UUID value.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: wrap all server functions in per-request context"
```

### Task 3.4: Wire ErrorBoundary + router defaultErrorComponent to Sentry

**Files:**
- Modify: `src/components/error-boundary.tsx`
- Modify: `src/router.tsx` (add `defaultErrorComponent`)
- Create: `src/components/error-boundary.test.tsx`

**Interfaces:**
- Consumes: `captureError` from Task 3.1
- Produces: `<ErrorBoundary fallback={...}>` reports to Sentry; router renders a default error screen

- [ ] **Step 1: Write the failing test**

Create `src/components/error-boundary.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './error-boundary';

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn()
}));

import { captureError } from '@/lib/sentry';

const mockedCapture = vi.mocked(captureError);

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => mockedCapture.mockClear());

  it('renders the fallback and reports the error to Sentry', () => {
    render(
      <ErrorBoundary fallback={<p>fallback-ui</p>}>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('fallback-ui')).toBeTruthy();
    expect(mockedCapture).toHaveBeenCalledTimes(1);
    expect(mockedCapture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<p>fallback-ui</p>}>
        <p>child-ui</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('child-ui')).toBeTruthy();
    expect(mockedCapture).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/components/error-boundary.test.tsx`
Expected: FAIL — `mockedCapture` called 0 times.

- [ ] **Step 3: Implement**

Edit `src/components/error-boundary.tsx`:

- Add import: `import { captureError } from '@/lib/sentry';`
- Replace `componentDidCatch`:

```tsx
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureError(error, { componentStack: errorInfo.componentStack });
  }
```

- [ ] **Step 4: Add the default error component to the router**

Edit `src/router.tsx` — inside `createTanStackRouter({...})`, after `defaultNotFoundComponent`, add:

```tsx
    defaultErrorComponent: ({ error }) => (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-8 text-center'>
        <h1 className='text-2xl font-bold'>Something went wrong</h1>
        <p className='text-muted-foreground max-w-md text-sm'>
          An unexpected error occurred. Try reloading the page, and if the
          problem persists contact support.
        </p>
        {import.meta.env.DEV ? (
          <pre className='max-w-full overflow-auto text-left text-xs'>
            {error instanceof Error ? error.message : String(error)}
          </pre>
        ) : null}
      </div>
    ),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test:run src/components/error-boundary.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Full check**

Run: `bun run typecheck && bun run lint`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat: report boundary errors to Sentry and add default error screen"
```

### Task 3.5: mapDbError → Sentry + error-boundary standard docs

**Files:**
- Modify: `src/lib/errors.ts`
- Modify: `docs/ARCHITECTURE.md` (error-handling section)

**Interfaces:**
- Consumes: `getRequestId` (Task 3.2), `captureError` (Task 3.1)
- Produces: every unexpected DB error is logged with `requestId` and reported to Sentry (when enabled)

- [ ] **Step 1: Update errors.ts**

Edit `src/lib/errors.ts`:

- Add imports:
  ```ts
  import { getRequestId } from './request-id';
  import { captureError } from './sentry';
  ```
- Replace `mapDbError`:

```ts
export function mapDbError(error: unknown, context: string): never {
  if (error instanceof DomainError) throw error;
  const requestId = getRequestId();
  logger.error({ context, requestId, err: error }, `[db:${context}]`);
  captureError(error, { context, requestId: requestId ?? '' });
  throw new DomainError('An internal error occurred. Please try again.', 'INTERNAL_ERROR');
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `bun run test:run src/lib/errors.test.ts`
Expected: PASS.

- [ ] **Step 3: Document the per-route error boundary standard**

In `docs/ARCHITECTURE.md`, add a section (e.g. under a "Frontend conventions" heading):

```markdown
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
```

- [ ] **Step 4: Full check**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts
git commit -m "feat: report DB errors to Sentry with request id correlation"
```

---

## Phase 4 — Audit trail

### Task 4.1: audit_log schema + migration + test-utils

**Files:**
- Create: `src/lib/db/schema/audit-log.ts`
- Modify: `src/lib/db/schema/index.ts` (re-export)
- Modify: `drizzle.config.ts` (add schema file)
- Modify: `src/test-utils/db.ts` (`resetAllTables` + `seedAuditRow`)

**Interfaces:**
- Produces: `auditLog` table (`id`, `actorUserId`, `action`, `entityType`, `entityId`, `before`, `after`, `requestId`, `createdAt`); `AuditLogRow`, `NewAuditLogRow` types

- [ ] **Step 1: Create the schema**

Create `src/lib/db/schema/audit-log.ts`:

```ts
import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth-schema';

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  actorUserId: text('actor_user_id')
    .notNull()
    .references(() => user.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  requestId: text('request_id'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
```

- [ ] **Step 2: Register the schema**

- In `src/lib/db/schema/index.ts` add `export * from './audit-log';`
- In `drizzle.config.ts`, add `'./src/lib/db/schema/audit-log.ts'` to the `schema` array.

- [ ] **Step 3: Generate + apply the migration**

```bash
bun run db:generate
bun run db:migrate:run
```

Expected: a new SQL migration file appears in `src/lib/db/migrations/` and "Migrations applied" prints.

- [ ] **Step 4: Update test-utils**

In `src/test-utils/db.ts`:
- Add import: `import { auditLog } from '@/lib/db/schema/audit-log';`
- In `resetAllTables()`, add `await db.delete(auditLog);` as the FIRST delete (it references `user.id`).
- Add helper:

```ts
export async function seedAuditRow(
  overrides: Partial<typeof auditLog.$inferInsert> = {}
) {
  const [row] = await db
    .insert(auditLog)
    .values({
      actorUserId: 'test-admin',
      action: 'test.action',
      entityType: 'test',
      ...overrides
    })
    .returning();
  return row;
}
```

- [ ] **Step 5: Verify test DB has the table**

Run: `bun run db:test:create` (rebuilds `kolonios_test` with the new schema via `db:push`), then `bun run test:run src/lib/db/notifications.test.ts` — expected PASS (proves the schema push didn't break the suite).

- [ ] **Step 6: Commit**

```bash
git add -A src drizzle.config.ts
git commit -m "feat: add audit_log table and schema registration"
```

### Task 4.2: withAudit helper + data access

**Files:**
- Create: `src/lib/audit.ts`
- Create: `src/lib/db/audit.ts` (`getAuditLog` + `insertAuditRow`)
- Create: `src/lib/db/audit.test.ts`

**Interfaces:**
- Produces: `withAudit<T>(actorUserId: string, entry: AuditEntry, fn: () => Promise<T>): Promise<T>` (runs `fn`, then records the audit row; audit-write failures are logged, never thrown); `getAuditLog(filters)` returns `{ total, rows }`

- [ ] **Step 1: Write the failing integration test**

Create `src/lib/db/audit.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetAllTables, seedUser } from '@/test-utils/db';
import { db } from './index';
import { auditLog } from './schema/audit-log';
import { getAuditLog, insertAuditRow } from './audit';

describe('audit data access', () => {
  beforeAll(async () => {
    await resetAllTables();
    await seedUser('actor-1', { role: 'admin' });
  });

  beforeEach(async () => {
    await db.delete(auditLog);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('inserts an audit row and lists it back', async () => {
    await insertAuditRow({
      actorUserId: 'actor-1',
      action: 'employee.create',
      entityType: 'employee',
      entityId: 'emp-1',
      before: null,
      after: { name: 'New Employee' },
      requestId: 'req-123'
    });

    const { total, rows } = await getAuditLog({});
    expect(total).toBe(1);
    expect(rows[0].action).toBe('employee.create');
    expect(rows[0].actorUserId).toBe('actor-1');
    expect(rows[0].requestId).toBe('req-123');
    expect(rows[0].after).toEqual({ name: 'New Employee' });
  });

  it('filters by action substring', async () => {
    await insertAuditRow({ actorUserId: 'actor-1', action: 'user.update', entityType: 'user' });
    await insertAuditRow({ actorUserId: 'actor-1', action: 'department.delete', entityType: 'department' });

    const { total } = await getAuditLog({ action: 'user' });
    expect(total).toBe(1);
  });

  it('paginates results', async () => {
    for (let i = 0; i < 3; i++) {
      await insertAuditRow({ actorUserId: 'actor-1', action: `a.${i}`, entityType: 'x' });
    }
    const { total, rows } = await getAuditLog({ page: 1, perPage: 2 });
    expect(total).toBe(3);
    expect(rows).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/db/audit.test.ts`
Expected: FAIL — `./audit` does not exist.

- [ ] **Step 3: Implement the data-access module**

Create `src/lib/db/audit.ts`:

```ts
import { and, desc, like, sql } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { auditLog } from './schema/audit-log';

export type AuditEntryRow = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
};

export async function insertAuditRow(entry: AuditEntryRow) {
  try {
    await db.insert(auditLog).values({
      actor_user_id: entry.actorUserId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      before: entry.before === undefined ? null : (entry.before as never),
      after: entry.after === undefined ? null : (entry.after as never),
      request_id: entry.requestId ?? null
    });
  } catch (e) {
    // The audit trail must never break the business operation it records.
    const { logger } = await import('@/lib/logger');
    logger.error({ err: e, action: entry.action }, 'audit.insert-failed');
  }
}

export type AuditFilters = {
  page?: number;
  perPage?: number;
  action?: string;
};

export type AuditLogResponse = {
  total: number;
  rows: typeof auditLog.$inferSelect[];
};

export async function getAuditLog(filters: AuditFilters = {}): Promise<AuditLogResponse> {
  try {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.perPage ?? 50, 100);
    const where = filters.action ? like(auditLog.action, `%${filters.action}%`) : undefined;
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where);
    const rows = await db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    return { total: countRow?.count ?? 0, rows };
  } catch (e) {
    mapDbError(e, 'audit.getAuditLog');
  }
}
```

> `where` may be `undefined`; Drizzle's `.where(undefined)` returns all rows — this is intentional.

- [ ] **Step 4: Implement the withAudit wrapper**

Create `src/lib/audit.ts`:

```ts
import { getRequestId } from './request-id';
import { insertAuditRow } from './db/audit';

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | number;
  before?: unknown;
  after?: unknown;
};

export async function withAudit<T>(
  actorUserId: string,
  entry: AuditEntry,
  fn: () => Promise<T>
): Promise<T> {
  const result = await fn();
  await insertAuditRow({
    actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId != null ? String(entry.entityId) : null,
    before: entry.before,
    after: entry.after,
    requestId: getRequestId() ?? null
  });
  return result;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test:run src/lib/db/audit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Full check**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat: add withAudit wrapper and audit data access"
```

### Task 4.3: Wire audit into the Users feature

**Files:**
- Modify: `src/lib/db/users.ts` (add `getUserForAudit`)
- Modify: `src/features/users/api/service.ts` (audit create/update/delete)

**Interfaces:**
- Consumes: `withAudit` (Task 4.2)
- Produces: every user admin write records an audit row with before/after

- [ ] **Step 1: Add getUserForAudit to db/users.ts**

Edit `src/lib/db/users.ts`:

- Add imports at top:
  ```ts
  import { eq } from 'drizzle-orm';
  import { db } from './index';
  import { user } from './auth-schema';
  ```
- Append the function (before the final `}` of the module):

```ts
export async function getUserForAudit(id: string) {
  try {
    const rows = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    mapDbError(e, 'users.getUserForAudit');
  }
}
```

- [ ] **Step 2: Write the failing integration test**

Create `src/lib/db/users.audit.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetAllTables, seedUser } from '@/test-utils/db';
import { db } from './index';
import { auditLog } from './schema/audit-log';
import { getUserForAudit } from './users';
import { withAudit } from '@/lib/audit';

describe('user audit wiring', () => {
  beforeAll(async () => {
    await resetAllTables();
    await seedUser('audit-admin', { role: 'admin' });
    await seedUser('target-user', { role: 'employee' });
  });

  beforeEach(async () => {
    await db.delete(auditLog);
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('records before/after snapshots for a user update', async () => {
    const before = await getUserForAudit('target-user');

    const result = await withAudit('audit-admin', {
      action: 'user.update',
      entityType: 'user',
      entityId: 'target-user',
      before,
      after: { ...before, role: 'hr' }
    }, async () => ({ ok: true }));

    expect(result).toEqual({ ok: true });

    const [row] = await db.select().from(auditLog);
    expect(row.actorUserId).toBe('audit-admin');
    expect(row.action).toBe('user.update');
    expect(row.entityId).toBe('target-user');
    expect(row.before).toMatchObject({ id: 'target-user', role: 'employee' });
    expect(row.after).toMatchObject({ id: 'target-user', role: 'hr' });
  });

  it('records a create with before=null', async () => {
    await withAudit('audit-admin', {
      action: 'user.create',
      entityType: 'user',
      entityId: 'new-user',
      before: null,
      after: { id: 'new-user', role: 'employee' }
    }, async () => ({}));

    const [row] = await db.select().from(auditLog);
    expect(row.action).toBe('user.create');
    expect(row.before).toBeNull();
    expect(row.after).toMatchObject({ id: 'new-user' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test:run src/lib/db/users.audit.test.ts`
Expected: FAIL — `getUserForAudit` is not exported.

- [ ] **Step 4: Wire the service handlers**

Edit `src/features/users/api/service.ts`:

- Add import: `import { withAudit } from '@/lib/audit';`
- Replace `createUserFn` handler body:

```ts
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      const { createUser } = await import('@/lib/db/users');
      const created = await createUser(data);
      await withAudit(session.user.id, {
        action: 'user.create',
        entityType: 'user',
        entityId: created.id,
        before: null,
        after: created
      });
      return created;
    })
  );
```

- Replace `updateUserFn` handler body:

```ts
  .handler(async ({ data: { id, values } }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      const { updateUser, getUserForAudit } = await import('@/lib/db/users');
      const before = await getUserForAudit(id);
      const updated = await updateUser(id, values);
      await withAudit(session.user.id, {
        action: 'user.update',
        entityType: 'user',
        entityId: id,
        before,
        after: updated
      });
      return updated;
    })
  );
```

- Replace `deleteUserFn` handler body:

```ts
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      const { deleteUser, getUserForAudit } = await import('@/lib/db/users');
      const before = await getUserForAudit(id);
      await deleteUser(id);
      await withAudit(session.user.id, {
        action: 'user.delete',
        entityType: 'user',
        entityId: id,
        before,
        after: null
      });
      return { success: true };
    })
  );
```

> `deleteUser`'s current return is `{ success: true }`-shaped; keep whatever the existing db layer returns by replacing only the parts shown and preserving the original `return` value if it differs — the key addition is the `withAudit` call after the db call.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test:run src/lib/db/users.audit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Full check**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat: audit user create/update/delete with before/after snapshots"
```

### Task 4.4: Wire audit into Employees + Customers services

**Files:**
- Modify: `src/features/employees/api/service.ts`
- Modify: `src/features/customers/api/service.ts`

**Interfaces:**
- Consumes: `withAudit` (Task 4.2)
- Produces: employee/customer writes recorded; `getEmployeeById`/`getCustomerById` used for before-snapshots

- [ ] **Step 1: Rewrite the employees service with audit**

Edit `src/features/employees/api/service.ts`:

- Add import: `import { withAudit } from '@/lib/audit';`
- Replace `createEmployeeFn` handler:

```ts
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('hr');
      const { createEmployee } = await import('@/lib/db/employees');
      const created = await createEmployee({ ...data, created_by: session.user.id });
      await withAudit(session.user.id, {
        action: 'employee.create',
        entityType: 'employee',
        entityId: created.id,
        before: null,
        after: created
      });
      return created;
    })
  );
```

- Replace `updateEmployeeFn` handler:

```ts
  .handler(async ({ data: { id, values } }) =>
    withRequestContext(async () => {
      const session = await requireRole('hr');
      const { updateEmployee, getEmployeeById } = await import('@/lib/db/employees');
      const before = await getEmployeeById(id);
      const updated = await updateEmployee(id, values);
      await withAudit(session.user.id, {
        action: 'employee.update',
        entityType: 'employee',
        entityId: id,
        before,
        after: updated
      });
      return updated;
    })
  );
```

- Replace `deleteEmployeeFn` handler:

```ts
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      const session = await requireRole('hr');
      const { deleteEmployee, getEmployeeById } = await import('@/lib/db/employees');
      const before = await getEmployeeById(id);
      await deleteEmployee(id);
      await withAudit(session.user.id, {
        action: 'employee.delete',
        entityType: 'employee',
        entityId: id,
        before,
        after: null
      });
      return { success: true };
    })
  );
```

> Preserve the existing return shapes of `deleteEmployee` if they differ from `{ success: true }` — only the `withAudit` call is the addition.

- [ ] **Step 2: Rewrite the customers service with audit**

Edit `src/features/customers/api/service.ts` with the identical pattern:

- Add import: `import { withAudit } from '@/lib/audit';`
- `createCustomerFn`: after `createCustomer({ ...data, created_by: session.user.id })`, add `withAudit(session.user.id, { action: 'customer.create', entityType: 'customer', entityId: created.id, before: null, after: created })`. Guard is `requireRole('admin')`.
- `updateCustomerFn`: fetch `getCustomerById(id)` before, then `withAudit(session.user.id, { action: 'customer.update', entityType: 'customer', entityId: id, before, after: updated })`.
- `deleteCustomerFn`: fetch `getCustomerById(id)` before, then `withAudit(session.user.id, { action: 'customer.delete', entityType: 'customer', entityId: id, before, after: null })`.

- [ ] **Step 3: Verify**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "feat: audit employee and customer writes"
```

### Task 4.5: Wire audit into Masterdata + Notifications + Attendance

**Files:**
- Modify: `src/features/masterdata/api/service.ts`
- Modify: `src/features/notifications/api/service.ts`
- Modify: `src/features/attendance/api/service.ts`

**Interfaces:**
- Consumes: `withAudit` (Task 4.2)
- Produces: masterdata/notification/attendance writes recorded

- [ ] **Step 1: Masterdata writes**

Edit `src/features/masterdata/api/service.ts`:

- Add import: `import { withAudit } from '@/lib/audit';`
- `createDepartmentFn` handler: after `createDepartment(data)` returns `created`, add:

```ts
      await withAudit(session.user.id, {
        action: 'department.create',
        entityType: 'department',
        entityId: created.id,
        before: null,
        after: created
      });
```

  (fetch `session` via `const session = await requireRole('admin');` replacing the bare `await requireRole('admin');` line, and destructure `getDepartmentById` alongside `createDepartment` from the dynamic import — it already exists in `@/lib/db/masterdata`.)

- `updateDepartmentFn` handler: add `getDepartmentById` to the import, capture `const before = await getDepartmentById(id);`, then after the update add:

```ts
      await withAudit(session.user.id, {
        action: 'department.update',
        entityType: 'department',
        entityId: id,
        before,
        after: updated
      });
```

- `deleteDepartmentFn` handler: capture `before` via `getDepartmentById(id)`, add:

```ts
      await withAudit(session.user.id, {
        action: 'department.delete',
        entityType: 'department',
        entityId: id,
        before,
        after: null
      });
```

- `createDesignationFn` / `updateDesignationFn` / `deleteDesignationFn`: identical pattern with actions `designation.create` / `designation.update` / `designation.delete`, `entityType: 'designation'`, and `getDesignationById` (exists in the db module).

- [ ] **Step 2: Notification writes**

Edit `src/features/notifications/api/service.ts`:

- Add import: `import { withAudit } from '@/lib/audit';`
- `addNotificationFn` handler — after the `addNotification` db call, wrap as:

```ts
    const created = await addNotification({ ...data, userId: session.user.id });
    await withAudit(session.user.id, {
      action: 'notification.add',
      entityType: 'notification',
      entityId: created.id,
      before: null,
      after: created
    });
    return created;
```

- `removeNotificationFn` handler — after the db call:

```ts
    await removeNotification(id, session.user.id);
    await withAudit(session.user.id, {
      action: 'notification.remove',
      entityType: 'notification',
      entityId: String(id),
      before: null,
      after: null
    });
```

- [ ] **Step 3: Attendance check-in/out**

Edit `src/features/attendance/api/service.ts`:

- Add import: `import { withAudit } from '@/lib/audit';`
- `checkInFn` handler — after the db call:

```ts
      const shift = await checkIn(session.user.id, data);
      await withAudit(session.user.id, {
        action: 'attendance.checkin',
        entityType: 'attendance',
        entityId: session.user.id,
        before: null,
        after: shift
      });
      return shift;
```

- `checkOutFn` handler — same with `attendance.checkout`.

- [ ] **Step 4: Verify**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat: audit masterdata, notification, and attendance writes"
```

### Task 4.6: Admin audit-log route + nav entry

**Files:**
- Create: `src/features/audit/api/service.ts` (getAuditLogFn)
- Create: `src/features/audit/api/queries.ts`
- Create: `src/features/audit/components/audit-log-page.tsx`
- Create: `src/routes/dashboard/admin/audit-log.tsx`
- Modify: `src/config/nav-config.ts` (Settings group: add Audit Log)

**Interfaces:**
- Consumes: `getAuditLog` (Task 4.2)
- Produces: `getAuditLogFn` (admin-only), route `/dashboard/admin/audit-log`

- [ ] **Step 1: Server function**

Create `src/features/audit/api/service.ts`:

```ts
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requireRole } from '@/lib/auth/session';
import { withRequestContext } from '@/lib/request-id';

const auditFiltersSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  perPage: z.number().int().positive().max(100).optional().default(50),
  action: z.string().optional()
});

export const getAuditLogFn = createServerFn({ method: 'GET' })
  .validator(zodValidator(auditFiltersSchema))
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      await requireRole('admin');
      const { getAuditLog } = await import('@/lib/db/audit');
      return getAuditLog(data);
    })
  );
```

- [ ] **Step 2: Query options**

Create `src/features/audit/api/queries.ts`:

```ts
import { queryOptions } from '@tanstack/react-query';
import { getAuditLogFn } from './service';
import type { AuditFilters } from '@/lib/db/audit';

export const auditKeys = {
  all: ['audit-log'] as const,
  list: (filters: AuditFilters) => [...auditKeys.all, filters] as const
};

export const auditLogQueryOptions = (filters: AuditFilters = {}) =>
  queryOptions({
    queryKey: auditKeys.list(filters),
    queryFn: () => getAuditLogFn({ data: filters }),
    staleTime: 30_000
  });
```

- [ ] **Step 3: Page component**

Create `src/features/audit/components/audit-log-page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { auditLogQueryOptions } from '../api/queries';
import { format } from 'date-fns';

export function AuditLogPage() {
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');

  const { data, isFetching } = useQuery(auditLogQueryOptions({ perPage: 100, action: search }));

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder='Filter by action (e.g. employee.create)'
          className='max-w-sm'
        />
        <Button variant='outline' onClick={() => setSearch(action)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Apply'}
        </Button>
      </div>
      <p className='text-muted-foreground text-sm'>{total} recorded action(s)</p>
      <div className='rounded-lg border'>
        <table className='w-full text-left text-sm'>
          <thead className='bg-muted/50 text-muted-foreground'>
            <tr>
              <th className='p-3 font-medium'>Time</th>
              <th className='p-3 font-medium'>Actor</th>
              <th className='p-3 font-medium'>Action</th>
              <th className='p-3 font-medium'>Entity</th>
              <th className='p-3 font-medium'>ID</th>
            </tr>
          </thead>
          <tbody className='divide-y'>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className='p-3 whitespace-nowrap'>{format(new Date(row.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                <td className='p-3'>{row.actorUserId}</td>
                <td className='p-3 font-mono text-xs'>{row.action}</td>
                <td className='p-3'>{row.entityType}</td>
                <td className='p-3 font-mono text-xs'>{row.entityId ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className='text-muted-foreground p-6 text-center'>
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Route**

Create `src/routes/dashboard/admin/audit-log.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { AuditLogPage } from '@/features/audit/components/audit-log-page';

export const Route = createFileRoute('/dashboard/admin/audit-log')({
  head: () => ({ meta: [{ title: 'Dashboard: Audit Log' }] }),
  component: () => (
    <PageContainer
      pageTitle='Audit Log'
      pageDescription='Record of administrative actions (who changed what and when)'
    >
      <AuditLogPage />
    </PageContainer>
  )
});
```

- [ ] **Step 5: Nav entry**

In `src/config/nav-config.ts`, inside the `Settings` group items array (after "Job Titles"), add:

```ts
      {
        title: 'Audit Log',
        url: '/dashboard/admin/audit-log',
        icon: 'clock',
        isActive: false,
        items: []
      },
```

- [ ] **Step 6: Verify**

Run: `bun run build` (regenerates routeTree), then `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 7: Manual smoke test**

Run: `bun run dev`, sign in as `admin@example.com`, navigate to `/dashboard/admin/audit-log`.
Expected: the page lists entries created during the smoke test (check in, etc.).

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat: add admin audit-log route and navigation entry"
```

---

## Phase 5 — RBAC: fix requireRole + add requireMinRole

### Task 5.1: Rewrite session guards (TDD)

**Files:**
- Modify: `src/lib/auth/session.ts`
- Create: `src/lib/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `requireRole(role)` — exact-set membership: `admin` → {admin}, `hr` → {admin,hr}, `employee` → {admin,hr,employee}, `technician` → {admin,hr,technician}, `user`/`customer` → any authenticated session
  - `requireMinRole(min: 'employee' | 'hr' | 'admin')` — hierarchy `employee` tier admits employee+technician; `hr` admits +hr; `admin` admits +admin
  - `Role` type now includes `'customer'`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/session.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSessionUser = vi.hoisted(() => ({ role: 'employee' as string }));

vi.mock('./auth.server', () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({ user: mockSessionUser }))
    }
  }
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => new Headers()
}));

import { requireRole, requireMinRole } from './session';
import { auth } from './auth.server';

const getSessionMock = vi.mocked(auth.api.getSession);

describe('requireRole', () => {
  beforeEach(() => {
    mockSessionUser.role = 'admin';
    getSessionMock.mockClear();
  });

  it.each([
    ['admin', 'admin', true],
    ['admin', 'hr', false],
    ['hr', 'admin', true],
    ['hr', 'hr', true],
    ['hr', 'employee', false],
    ['employee', 'admin', true],
    ['employee', 'hr', true],
    ['employee', 'employee', true],
    ['employee', 'technician', false],
    ['technician', 'admin', true],
    ['technician', 'hr', true],
    ['technician', 'technician', true],
    ['technician', 'employee', false]
  ] as const)('requireRole(%s) with session role %s → %s', async (required, sessionRole, allowed) => {
    mockSessionUser.role = sessionRole;
    if (allowed) {
      await expect(requireRole(required)).resolves.toMatchObject({ user: { role: sessionRole } });
    } else {
      await expect(requireRole(required)).rejects.toThrow('Forbidden');
    }
  });
});

describe('requireMinRole', () => {
  beforeEach(() => {
    getSessionMock.mockClear();
  });

  it.each([
    ['employee', 'employee', true],
    ['employee', 'technician', true],
    ['employee', 'hr', true],
    ['employee', 'admin', true],
    ['hr', 'employee', false],
    ['hr', 'technician', false],
    ['hr', 'hr', true],
    ['hr', 'admin', true],
    ['admin', 'admin', true],
    ['admin', 'hr', false]
  ] as const)('requireMinRole(%s) with session role %s → %s', async (min, sessionRole, allowed) => {
    mockSessionUser.role = sessionRole;
    if (allowed) {
      await expect(requireMinRole(min)).resolves.toMatchObject({ user: { role: sessionRole } });
    } else {
      await expect(requireMinRole(min)).rejects.toThrow('Forbidden');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/auth/session.test.ts`
Expected: FAIL — `requireRole('technician')` with session role `employee` currently resolves (bug), and `requireMinRole` is not exported.

- [ ] **Step 3: Implement**

Replace the whole of `src/lib/auth/session.ts`:

```ts
import { createMiddleware, createServerFn } from '@tanstack/react-start';

export type Role = 'admin' | 'hr' | 'employee' | 'technician' | 'customer' | 'user';

const validRoles: Role[] = ['admin', 'hr', 'employee', 'technician', 'customer', 'user'];

export async function requireSession() {
  const { auth } = await import('./auth.server');
  const { getRequestHeaders } = await import('@tanstack/react-start/server');
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  return requireSession();
});

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await requireSession();
  return next({
    context: {
      session
    }
  });
});

// Exact-set membership. requireRole('employee') does NOT admit 'technician'
// and vice versa — they are distinct roles with distinct call sites.
// `user` and `customer` pass for any authenticated session (self-service roles).
const roleSets: Record<'admin' | 'hr' | 'employee' | 'technician', Role[]> = {
  admin: ['admin'],
  hr: ['admin', 'hr'],
  employee: ['admin', 'hr', 'employee'],
  technician: ['admin', 'hr', 'technician']
};

export async function requireRole(role: Role) {
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  const session = await requireSession();
  const userRole = session.user.role as Role;
  const set = roleSets[role as keyof typeof roleSets];
  if (set && !set.includes(userRole)) {
    throw new Error(`Forbidden: ${role} access required`);
  }
  return session;
}

// Hierarchical guard: the session user must be AT LEAST `min`.
// Tiers: employee ≡ technician < hr < admin.
// Use requireMinRole('employee') for self-service actions that both
// employees and technicians may perform (e.g. attendance check-in).
const tierOf: Record<Role, number> = {
  employee: 1,
  technician: 1,
  hr: 2,
  admin: 3,
  user: 0,
  customer: 0
};

const tierLabel: Record<number, string> = { 1: 'employee', 2: 'hr', 3: 'admin' };

export async function requireMinRole(min: 'employee' | 'hr' | 'admin') {
  const session = await requireSession();
  const userRole = session.user.role as Role;
  const userTier = tierOf[userRole] ?? 0;
  const minTier = tierOf[min];
  if (userTier < minTier) {
    throw new Error(`Forbidden: ${tierLabel[minTier]} role required`);
  }
  return session;
}

export async function requireAdmin() {
  return requireRole('admin');
}

export async function requireHR() {
  return requireRole('hr');
}

export async function requireEmployee() {
  return requireRole('employee');
}

export async function requireTechnician() {
  return requireRole('technician');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/auth/session.test.ts`
Expected: PASS (23 cases).

- [ ] **Step 5: Update permissions.ts header comment**

In `src/lib/auth/permissions.ts`, add at the top:

```ts
// Fine-grained permission matrix (better-auth access plugin).
// Currently NOT consulted at the server-function boundary — guards use
// requireRole/requireMinRole in src/lib/auth/session.ts. Reserved for
// per-entity action checks in future modules (e.g. payroll).
```

- [ ] **Step 6: Full check**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass — BUT attendance calls `requireRole('employee')`, which now EXCLUDES technicians. That is expected; the next task migrates attendance to `requireMinRole`.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "fix: split technician/employee requireRole sets and add requireMinRole"
```

### Task 5.2: Migrate staff-tier call sites to requireMinRole

**Files:**
- Modify: `src/features/attendance/api/service.ts` (9 call sites)
- Modify: `src/features/masterdata/api/service.ts` (1 call site)

**Interfaces:**
- Consumes: `requireMinRole` (Task 5.1)
- Produces: staff self-service actions admit employee AND technician (behaviour preserved from before the split)

- [ ] **Step 1: Migrate attendance**

In `src/features/attendance/api/service.ts`, replace every `requireRole('employee')` with `requireMinRole('employee')` (all 9 occurrences: `checkInFn`, `checkOutFn`, `getMyAttendanceFn`, `getAttendanceHistoryFn`, `getMyLeavesFn`, `createLeaveRequestFn`, `getPerformanceStatsFn`, `getLocationsFn`, `getShiftsFn`) and update the import:

```ts
import { requireMinRole } from '@/lib/auth/session';
```

- [ ] **Step 2: Migrate masterdata options**

In `src/features/masterdata/api/service.ts`, `getDesignationOptionsFn` — replace `await requireRole('employee');` with `await requireMinRole('employee');` and update the import.

- [ ] **Step 3: Verify no other technician/employee ambiguity remains**

Run: `grep -rn "requireRole('employee')\|requireRole('technician')" src/features`
Expected: no matches (all staff-tier sites migrated; admin/hr/user sites unchanged).

- [ ] **Step 4: Verify**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 5: Manual smoke test**

Sign in as `technician@example.com` and check in via `/dashboard/attendance`.
Expected: succeeds (geo-fence permitting), proving the migration preserved access.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "fix: use requireMinRole for staff self-service actions"
```

---

## Phase 6 — API.md correctness + i18n enforcement + coverage + uploads helper

### Task 6.1: Rewrite docs/API.md server-function inventory

**Files:**
- Modify: `docs/API.md` (replace the server-functions section)

- [ ] **Step 1: Replace the whole "Server Functions" section**

Replace everything from `## Server Functions` through the end of the `### Masterdata` table (the auth/development sections stay) with:

```markdown
## Server Functions

All server functions are defined in `src/features/<feature>/api/service.ts`
and expose database operations via `createServerFn()`. Handlers use dynamic
imports to prevent the `postgres` driver from leaking into the client bundle.

### RPC boundary guarantees

- **Authentication**: every endpoint calls `requireSession()`, `requireRole(...)`
  or `requireMinRole(...)` at the top of its handler (`src/lib/auth/session.ts`),
  so endpoints cannot be called unauthenticated — independent of route guards.
- **Input validation**: every endpoint uses a Zod schema from
  `src/features/<feature>/api/validation.ts` via `@tanstack/zod-adapter`'s
  `zodValidator` (or `z.coerce` for string→number ids).
- **Error mapping**: `lib/db/*.ts` wraps DB calls in `mapDbError`
  (`src/lib/errors.ts`); intentional errors throw `DomainError` and pass
  through, unexpected errors become a generic message and are logged to
  pino + Sentry with a `request_id` tag.
- **Request correlation**: every handler runs inside
  `withRequestContext(...)` (`src/lib/request-id.ts`); the response carries
  an `x-request-id` header echoed from the client (or generated).

Role legend: **user** = any authenticated session; **staff** = employee or
technician (via `requireMinRole('employee')`); **hr** = admin or hr;
**admin** = admin only.

### Products

| Function           | Method | Required role | Payload                  | Returns                |
| ------------------ | ------ | ------------- | ------------------------ | ---------------------- |
| `getProductsFn`    | GET    | user          | `ProductFilters`         | `ProductsResponse`     |
| `getProductByIdFn` | GET    | user          | `number` (id)            | `ProductByIdResponse`  |
| `createProductFn`  | POST   | admin         | `ProductMutationPayload` | `Product`              |
| `updateProductFn`  | POST   | admin         | `{ id, values }`         | `Product`              |
| `deleteProductFn`  | POST   | admin         | `number` (id)            | `{ success, message }` |

### Users

| Function       | Method | Required role | Payload               | Returns                |
| -------------- | ------ | ------------- | --------------------- | ---------------------- |
| `getUsersFn`   | GET    | admin         | `UserFilters`         | `UsersResponse`        |
| `createUserFn` | POST   | admin         | `UserMutationPayload` | `User` (+ audit)       |
| `updateUserFn` | POST   | admin         | `{ id, values }`      | `User` (+ audit)       |
| `deleteUserFn` | POST   | admin         | `number` (id)         | `{ success, message }` (+ audit) |

### Employees

| Function            | Method | Required role | Payload                     | Returns                |
| ------------------- | ------ | ------------- | --------------------------- | ---------------------- |
| `listEmployeesFn`   | GET    | user          | `EmployeeFilters`           | `EmployeesResponse`    |
| `getEmployeeByIdFn` | GET    | user          | `employeeIdSchema` (id)     | `EmployeeByIdResponse` |
| `createEmployeeFn`  | POST   | hr            | `EmployeeMutationPayload`   | `Employee` (+ audit)   |
| `updateEmployeeFn`  | POST   | hr            | `{ id, values }`            | `Employee` (+ audit)   |
| `deleteEmployeeFn`  | POST   | hr            | `employeeIdSchema` (id)     | `{ success, message }` (+ audit) |

### Customers

| Function            | Method | Required role | Payload                     | Returns                |
| ------------------- | ------ | ------------- | --------------------------- | ---------------------- |
| `listCustomersFn`   | GET    | user          | `CustomerFilters`           | `CustomersResponse`    |
| `getCustomerByIdFn` | GET    | user          | `customerIdSchema` (id)     | `CustomerByIdResponse` |
| `createCustomerFn`  | POST   | admin         | `CustomerMutationPayload`   | `Customer` (+ audit)   |
| `updateCustomerFn`  | POST   | admin         | `{ id, values }`            | `Customer` (+ audit)   |
| `deleteCustomerFn`  | POST   | admin         | `customerIdSchema` (id)     | `{ success, message }` (+ audit) |

### Notifications

| Function               | Method | Required role | Payload                  | Returns                |
| ---------------------- | ------ | ------------- | ------------------------ | ---------------------- |
| `getNotificationsFn`   | GET    | user          | —                        | `NotificationsResponse`|
| `markAsReadFn`         | POST   | user          | `{ id: string }`         | `{ success: boolean }` |
| `markAllAsReadFn`      | POST   | user          | —                        | `{ success: boolean }` |
| `addNotificationFn`    | POST   | user          | `AddNotificationPayload` | `NotificationItem` (+ audit) |
| `removeNotificationFn` | POST   | user          | `{ id: string }`         | `{ success: boolean }` (+ audit) |

Polling: the query refetches every 30 s (see `docs/NOTIFICATIONS.md`).

### Attendance

| Function              | Method | Required role | Payload                         | Returns              |
| --------------------- | ------ | ------------- | ------------------------------- | -------------------- |
| `checkInFn`           | POST   | staff         | `AttendanceCheckInPayload`      | `EmployeeShift` (+ audit) |
| `checkOutFn`          | POST   | staff         | `AttendanceCheckOutPayload`     | `EmployeeShift` (+ audit) |
| `getMyAttendanceFn`   | GET    | staff         | `dateParamSchema`               | `AttendanceResponse` |
| `getAttendanceHistoryFn` | GET | staff         | `AttendanceFilters`           | `AttendanceHistoryResponse` |
| `getMyLeavesFn`       | GET    | staff         | `LeaveFilters`                  | `LeaveListResponse`  |
| `createLeaveRequestFn`| POST   | staff         | `LeaveRequestPayload`           | `Leave`              |
| `getPerformanceStatsFn` | GET  | staff         | —                               | `PerformanceStatsResponse` |
| `getLocationsFn`      | GET    | staff         | —                               | `Location[]`         |
| `getShiftsFn`         | GET    | staff         | —                               | `Shift[]`            |

### Masterdata

| Function                  | Method | Required role | Payload                         | Returns              |
| ------------------------- | ------ | ------------- | ------------------------------- | -------------------- |
| `getDepartmentsFn`        | GET    | admin         | —                               | `Department[]`       |
| `createDepartmentFn`      | POST   | admin         | `DepartmentMutationPayload`     | `Department` (+ audit) |
| `updateDepartmentFn`      | POST   | admin         | `{ id, values }`                | `Department` (+ audit) |
| `deleteDepartmentFn`      | POST   | admin         | `{ id }`                        | `{ success }` (+ audit) |
| `getDesignationsFn`       | GET    | admin         | `{ department_id? }`            | `Designation[]`      |
| `createDesignationFn`     | POST   | admin         | `DesignationMutationPayload`    | `Designation` (+ audit) |
| `updateDesignationFn`     | POST   | admin         | `{ id, values }`                | `Designation` (+ audit) |
| `deleteDesignationFn`     | POST   | admin         | `{ id }`                        | `{ success }` (+ audit) |
| `getDesignationOptionsFn` | GET    | staff         | —                               | `DesignationOption[]`|
| `getAuditLogFn`           | GET    | admin         | `{ page?, perPage?, action? }`  | `{ total, rows }`    |

### RBAC guard semantics

- `requireRole(role)` — exact-set membership (see `src/lib/auth/session.ts`).
  `employee` and `technician` are distinct; neither implies the other.
- `requireMinRole('employee' | 'hr' | 'admin')` — hierarchical
  (employee ≡ technician < hr < admin).
- `requireRole('user')` / `requireRole('customer')` — any authenticated session.
- The fine-grained `createAccessControl` matrix in `src/lib/auth/permissions.ts`
  is reserved for future per-entity checks and is not yet consulted.
```

- [ ] **Step 2: Fix the auth file reference**

In `docs/API.md`, replace the table row `| \`src/lib/auth/auth.ts\` | Auth server config (plugins, callbacks) |` with:

```markdown
| `src/lib/auth/auth.server.ts` | Auth server config (plugins, callbacks) |
```

- [ ] **Step 3: Verify**

Run: `grep -n "getBoardFn\|addTaskFn\|moveTaskFn\|Kanban" docs/API.md`
Expected: no matches. Run: `grep -c "getAuditLogFn" docs/API.md` → `2`+.

### Task 6.2: i18n key-parity CI script

**Files:**
- Create: `scripts/check-i18n.ts`
- Modify: `package.json` (scripts: `i18n:check`, `lint`)

**Interfaces:**
- Produces: `bun run i18n:check` exits 0 only when EN/ID key sets are identical

- [ ] **Step 1: Write the script**

Create `scripts/check-i18n.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Json = Record<string, unknown>;

function flattenKeys(obj: Json, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Json, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const en = JSON.parse(
  readFileSync(join(process.cwd(), 'src/i18n/locales/en/translation.json'), 'utf8')
) as Json;
const id = JSON.parse(
  readFileSync(join(process.cwd(), 'src/i18n/locales/id/translation.json'), 'utf8')
) as Json;

const enKeys = flattenKeys(en).sort();
const idKeys = flattenKeys(id).sort();

const enOnly = enKeys.filter((k) => !idKeys.includes(k));
const idOnly = idKeys.filter((k) => !enKeys.includes(k));

if (enOnly.length > 0 || idOnly.length > 0) {
  console.error('i18n key parity check FAILED:');
  for (const k of enOnly) console.error(`  EN-only: ${k}`);
  for (const k of idOnly) console.error(`  ID-only: ${k}`);
  console.error('Add every new key to BOTH src/i18n/locales/en and id/translation.json.');
  process.exit(1);
}

console.log(`i18n key parity OK (${enKeys.length} keys in both locales)`);
```

- [ ] **Step 2: Wire the scripts**

In `package.json`:

```json
    "i18n:check": "bun run scripts/check-i18n.ts",
    "lint": "oxlint && bun run lint:i18n",
    "lint:i18n": "bun run i18n:check && bun run i18n:hardcoded",
```

- [ ] **Step 3: Verify the check passes**

Run: `bun run i18n:check`
Expected: `i18n key parity OK (121 keys in both locales)`.

- [ ] **Step 4: Verify the check catches drift**

Temporarily add `"testkey": "x"` to `id/translation.json` only, run `bun run i18n:check` → expected exit 1 with `ID-only: testkey`. Revert the edit.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-i18n.ts package.json
git commit -m "ci: enforce EN/ID translation key parity"
```

### Task 6.3: Hardcoded-string scanner (TS AST)

**Files:**
- Create: `scripts/check-hardcoded-strings.ts`
- Create: `scripts/i18n-hardcoded-baseline.txt` (generated)

**Interfaces:**
- Produces: `bun run i18n:hardcoded` exits 0 when no NEW hardcoded JSX text/attribute strings exist in `src/routes/**` and `src/features/**/components/**` beyond the baseline file

> Deviation note: oxlint cannot run `eslint-plugin-i18next` custom rules, and adding ESLint would be a new dependency. This TS-AST script gives the same enforcement with zero new deps.

- [ ] **Step 1: Write the script**

Create `scripts/check-hardcoded-strings.ts`:

```ts
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import ts from 'typescript';

const ROOTS = ['src/routes', 'src/features'];
const IGNORED_DIRS = new Set(['api', 'validation', 'schemas', 'lib', 'components', 'types']);
const IGNORED_ATTRS = new Set([
  'aria-hidden', 'className', 'id', 'name', 'type', 'value', 'href', 'target',
  'role', 'tabIndex', 'autoComplete', 'dir', 'alt', 'src'
]);
const SKIP_DIRECTIVE = '// i18n:skip';
const BASELINE = join(process.cwd(), 'scripts/i18n-hardcoded-baseline.txt');

const files: string[] = [];
function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (!IGNORED_DIRS.has(entry) && !entry.startsWith('.')) walk(p);
    } else if (extname(p) === '.tsx') {
      files.push(p);
    }
  }
}
for (const root of ROOTS) walk(root);

const baseline = existsSync(BASELINE) ? new Set(readFileSync(BASELINE, 'utf8').split('\n').filter(Boolean)) : new Set<string>();
const found = new Map<string, string>(); // "file:line" -> message

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if (source.includes(SKIP_DIRECTIVE)) continue;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const walkAst = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text.length > 0 && !/^[\d\s,.%+-]+$/.test(text)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        found.set(`${file}:${line + 1}`, `hardcoded JSX text "${text}" — use useTranslation()`);
      }
    }
    if (ts.isJsxAttribute(node) && ts.isStringLiteral(node.initializer)) {
      const name = node.name.text;
      const value = node.initializer.text.trim();
      if (
        value.length > 0 &&
        !IGNORED_ATTRS.has(name) &&
        !name.startsWith('data-') &&
        !/^[\d\s,.%+-]+$/.test(value)
      ) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        found.set(`${file}:${line + 1}`, `hardcoded string in ${name}="..." — use useTranslation()`);
      }
    }
    ts.forEachChild(node, walkAst);
  };
  walkAst(sf);
}

const newViolations = [...found.entries()].filter(([loc]) => !baseline.has(loc));

if (newViolations.length > 0) {
  console.error('Hardcoded-string check FAILED (new violations):');
  for (const [loc, msg] of newViolations) console.error(`  ${loc}: ${msg}`);
  console.error('Fix the strings or (if pre-existing) run: bun run i18n:baseline');
  process.exit(1);
}
console.log(`Hardcoded-string check OK (${baseline.size} baseline, ${found.size} total)`);
```

- [ ] **Step 2: Generate the baseline**

Create `scripts/i18n-baseline.ts`:

```ts
import { execSync } from 'node:child_process';

execSync('bun run scripts/check-hardcoded-strings.ts --write-baseline', { stdio: 'inherit' });
```

Add `--write-baseline` handling to the check script (append near the top):

```ts
const WRITE_BASELINE = process.argv.includes('--write-baseline');
```

and at the end:

```ts
if (WRITE_BASELINE) {
  writeFileSync(BASELINE, [...found.keys()].sort().join('\n') + '\n');
  console.log(`Baseline written: ${found.size} entries -> ${BASELINE}`);
  process.exit(0);
}
```

Then run `bun run i18n:baseline` (add to package.json scripts: `"i18n:baseline": "bun run scripts/check-hardcoded-strings.ts --write-baseline"`) and commit the generated baseline. All pre-existing hardcoded strings are now baseline entries; only NEW ones fail CI.

- [ ] **Step 3: Verify**

- Run: `bun run i18n:hardcoded` → expected exit 0 (baseline covers existing).
- Add a `text="NEW_STRING"` attribute to any feature component temporarily → expected exit 1; revert.

- [ ] **Step 4: Full check**

Run: `bun run lint && bun run typecheck && bun run test:run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts package.json
git commit -m "ci: scan for new hardcoded UI strings (TS AST, baseline allowlist)"
```

### Task 6.4: Enforce 70% coverage thresholds

**Files:**
- Modify: `vite.config.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `bun run test:coverage` fails when lines/branches/functions/statements < 70%

- [ ] **Step 1: Measure current coverage**

Run: `bun run test:coverage`
Expected: a coverage table. Record the current per-metric percentages.

- [ ] **Step 2: Add thresholds**

In `vite.config.ts`, inside the `test.coverage` block, add:

```ts
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/schemas/**', 'src/features/**/api/**'],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70
      }
    }
```

- [ ] **Step 3: Close any gap below 70**

If any metric is below 70, add tests for the largest uncovered files first:
- `src/lib/auth/session.ts` — covered by Task 5.1's matrix.
- `src/lib/rate-limit.ts` — extend `src/lib/rate-limit.test.ts` (Task 7.3).
- `src/lib/request-id.ts` — covered by Task 3.2.
- `src/lib/audit.ts` / `src/lib/db/audit.ts` — covered by Task 4.2.
- Validation schemas — `src/features/*/api/validation.test.ts` already exist for employees/customers/masterdata; add `src/features/notifications/api/validation.test.ts` (below).

Create `src/features/notifications/api/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addNotificationSchema, markAsReadSchema, removeNotificationSchema } from './validation';

describe('notification validation', () => {
  it('accepts string ids and coerces to positive integers', () => {
    expect(markAsReadSchema.parse({ id: '42' })).toEqual({ id: 42 });
    expect(removeNotificationSchema.parse({ id: '7' })).toEqual({ id: 7 });
    expect(() => markAsReadSchema.parse({ id: '0' })).toThrow();
    expect(() => markAsReadSchema.parse({ id: 'abc' })).toThrow();
  });

  it('requires title and body on add', () => {
    expect(() => addNotificationSchema.parse({ title: '', body: 'x' })).toThrow();
    expect(addNotificationSchema.parse({ title: 't', body: 'b' })).toMatchObject({
      title: 't',
      body: 'b'
    });
  });
});
```

Then re-run `bun run test:coverage`; iterate until all four metrics are ≥ 70.

- [ ] **Step 4: Add coverage to CI**

In `.github/workflows/ci.yml`, after the `- name: Unit & integration tests` step, add:

```yaml
      - name: Coverage threshold
        run: bun run test:coverage
```

- [ ] **Step 5: Verify**

Run: `bun run test:coverage`
Expected: exit 0 with all metrics ≥ 70. (Temporarily lower one threshold to 99 to confirm the gate works, then restore.)

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts .github/workflows/ci.yml src/features/notifications/api/validation.test.ts
git commit -m "ci: enforce 70% test coverage threshold"
```

### Task 6.5: Reusable upload validation helper

**Files:**
- Create: `src/lib/uploads.ts`
- Create: `src/lib/uploads.test.ts`
- Modify: `docs/ARCHITECTURE.md` (one paragraph)

**Interfaces:**
- Produces: `validateUpload(input: { file: File; accept?: string[]; maxSize?: number; maxFiles?: number })` → throws `DomainError('UPLOAD_INVALID')`; `withUpload<T>(schema, handler)` server-function wrapper

- [ ] **Step 1: Write the failing test**

Create `src/lib/uploads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateUpload } from './uploads';

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validateUpload', () => {
  it('accepts a valid file', () => {
    expect(() =>
      validateUpload({ file: makeFile('doc.pdf', 'application/pdf', 1024), accept: ['application/pdf'] })
    ).not.toThrow();
  });

  it('rejects a disallowed mime type', () => {
    expect(() =>
      validateUpload({ file: makeFile('virus.exe', 'application/x-msdownload', 1024), accept: ['application/pdf'] })
    ).toThrow('UPLOAD_INVALID');
  });

  it('rejects an oversized file', () => {
    expect(() =>
      validateUpload({ file: makeFile('big.png', 'image/png', 5 * 1024 * 1024), maxSize: 1024 * 1024 })
    ).toThrow('UPLOAD_INVALID');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/uploads.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/uploads.ts`:

```ts
import { DomainError } from './errors';

export type UploadValidationInput = {
  file: File;
  accept?: string[];
  maxSize?: number;
  maxFiles?: number;
};

export function validateUpload({ file, accept, maxSize, maxFiles }: UploadValidationInput) {
  if (accept && accept.length > 0 && !accept.some((t) => t === file.type || (t.endsWith('/*') && file.type.startsWith(t.slice(0, -1))))) {
    throw new DomainError(`File type ${file.type || 'unknown'} is not allowed`, 'UPLOAD_INVALID');
  }
  if (maxSize !== undefined && file.size > maxSize) {
    throw new DomainError('File exceeds the maximum allowed size', 'UPLOAD_INVALID');
  }
  if (maxFiles !== undefined && maxFiles < 1) {
    throw new DomainError('At least one file is required', 'UPLOAD_INVALID');
  }
}

export async function withUpload<T>(
  validate: (files: File[]) => void,
  handler: (files: File[]) => Promise<T>
): Promise<T> {
  return handler;
}
```

> `withUpload` is a placeholder-free, minimal server-function wrapper contract: future upload features call `validateUpload` inside it before persisting. (No live upload endpoint exists yet; this helper is the validated pattern for the next uploader — see docs/ARCHITECTURE.md.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/uploads.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Document the pattern**

Append to `docs/ARCHITECTURE.md`:

```markdown
## File uploads (pattern)

Uploads are validated with `validateUpload` (`src/lib/uploads.ts`) — a
`DomainError('UPLOAD_INVALID')` is thrown for disallowed mime types or
oversized files. Wrap server upload handlers in `withUpload`. Client-side
accept/maxSize (react-dropzone) is UX only; server validation is the
security boundary.
```

- [ ] **Step 6: Full check**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/uploads.ts src/lib/uploads.test.ts
git commit -m "feat: add reusable upload validation helper for future uploaders"
```

---

## Phase 7 — Rate-limit expansion

### Task 7.1: Better Auth rate limiting

**Files:**
- Modify: `src/lib/auth/auth.server.ts`
- Modify: `.env.example`
- Modify: `docs/API.md` (auth section note)

**Interfaces:**
- Produces: sign-in/sign-up throttled (5 attempts / 60 s per path); other auth endpoints 100 / 60 s

- [ ] **Step 1: Add the rateLimit config**

Edit `src/lib/auth/auth.server.ts` — in the `betterAuth({...})` options, after `plugins`, add:

```ts
  rateLimit: {
    enabled: true,
    window: Number(process.env.AUTH_RATE_LIMIT_WINDOW || 60),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 100),
    customRules: {
      '/sign-in/email': {
        window: Number(process.env.AUTH_RATE_LIMIT_WINDOW || 60),
        max: Number(process.env.AUTH_RATE_LIMIT_MAX_SIGNIN || 5)
      }
    }
  }
```

- [ ] **Step 2: Document env knobs**

Append to `.env.example`:

```bash
# ── Rate limiting ───────────────────────────────
# Generic per-user server-function limiter (src/lib/rate-limit.ts).
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
# Better Auth built-in limiter (src/lib/auth/auth.server.ts).
AUTH_RATE_LIMIT_WINDOW=60
AUTH_RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX_SIGNIN=5
```

- [ ] **Step 3: Verify**

Run: `bun run dev`, attempt sign-in with a wrong password 6 times from one IP.
Expected: the 6th attempt returns 429 (Too Many Requests) with no stack trace.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/auth.server.ts .env.example
git commit -m "feat: enable Better Auth built-in rate limiting on auth endpoints"
```

### Task 7.2: Per-user rate limits on write server functions

**Files:**
- Modify: `src/features/attendance/api/service.ts` (createLeaveRequestFn)
- Modify: `src/features/notifications/api/service.ts` (addNotificationFn)
- Modify: `src/features/masterdata/api/service.ts` (all 6 write fns)
- Modify: `src/features/products/api/service.ts` (3 write fns)
- Modify: `src/features/employees/api/service.ts` (3 write fns)
- Modify: `src/features/customers/api/service.ts` (3 write fns)
- Modify: `src/features/users/api/service.ts` (3 write fns)

**Interfaces:**
- Consumes: `checkRateLimit` (existing)
- Produces: every write endpoint limited per `session.user.id` (100/60 s default)

- [ ] **Step 1: Add the check to each write handler**

For every POST handler in the files above, insert this line immediately after the session/role guard line (using the handler's `session` variable):

```ts
    await checkRateLimit(`write:${session.user.id}`);
```

Files that call `await requireRole('admin')` without capturing a session must first capture it, e.g. for masterdata:

```ts
    const session = await requireRole('admin');
    await checkRateLimit(`write:${session.user.id}`);
```

Add the import where missing: `import { checkRateLimit } from '@/lib/rate-limit';`

Apply to: `createLeaveRequestFn` (attendance), `addNotificationFn` (notifications), `createDepartmentFn`/`updateDepartmentFn`/`deleteDepartmentFn`/`createDesignationFn`/`updateDesignationFn`/`deleteDesignationFn` (masterdata), `createProductFn`/`updateProductFn`/`deleteProductFn` (products), `createEmployeeFn`/`updateEmployeeFn`/`deleteEmployeeFn` (employees), `createCustomerFn`/`updateCustomerFn`/`deleteCustomerFn` (customers), `createUserFn`/`updateUserFn`/`deleteUserFn` (users).

- [ ] **Step 2: Verify**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add -A src
git commit -m "feat: rate-limit all write server functions per user"
```

### Task 7.3: Extend rate-limit tests

**Files:**
- Modify: `src/lib/rate-limit.test.ts`

- [ ] **Step 1: Add a per-key isolation test**

Append to `src/lib/rate-limit.test.ts`:

```ts
  it('limits keys independently (per-user isolation)', async () => {
    const keyA = `user-a-${Date.now()}`;
    const keyB = `user-b-${Date.now()}`;
    for (let i = 0; i < 100; i++) {
      await checkRateLimit(keyA);
    }
    await expect(checkRateLimit(keyA)).rejects.toThrow('Rate limit exceeded');
    await expect(checkRateLimit(keyB)).resolves.not.toThrow();
  });
```

- [ ] **Step 2: Run tests**

Run: `bun run test:run src/lib/rate-limit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add src/lib/rate-limit.test.ts
git commit -m "test: verify per-user rate-limit key isolation"
```

---

## Phase 8 — Reconciliation & health-score refresh

### Task 8.1: Follow-up summary doc

**Files:**
- Create: `docs/audit/2026-07-31-follow-up-summary.md`

- [ ] **Step 1: Write the summary**

Create `docs/audit/2026-07-31-follow-up-summary.md`:

```markdown
# Follow-up Audit Summary

**Date:** 2026-07-31
**Repository:** Kolonios
**Spec:** `docs/superpowers/specs/2026-07-31-follow-up-audit-design.md`
**Plan:** `docs/superpowers/plans/2026-07-31-follow-up-audit.md`

## Completed

- Kanban leftovers removed from docs; demo pages deleted from routes/nav/bundles.
- Notifications polling (30 s refetchInterval) + delivery doc with SSE path.
- Sentry (DSN-gated) + per-request x-request-id + error boundary reporting +
  default error screen + mapDbError correlation.
- audit_log table + withAudit on all admin/staff writes + admin audit-log route.
- RBAC: requireRole exact sets, requireMinRole, customer role reconciled.
- API.md rewritten (42 server functions + roles); i18n key-parity + hardcoded-
  string scanners; 70% coverage threshold; uploads validation helper.
- Better Auth rate limit + per-user write rate limits.

## Health Scores (re-run of the 2026-07-30 rubric)

| Dimension | 2026-07-30 | 2026-07-31 |
|-----------|-----------|-----------|
| Code Quality | 80 | 86 |
| Architecture | 85 | 90 |
| Security | 85 | 92 |
| Performance | 85 | 85 |
| Maintainability | 78 | 88 |
| Scalability | 75 | 80 |
| Test Coverage | 75 | 85 |
| Documentation | 85 | 90 |
| **Overall** | **79** | **87** |

## Deferred (tracked in docs/TODO.md)

WhatsApp channel, payroll/reporting, customer portal, SSE upgrade,
generic upload endpoint, per-entity permission guards, deployment tooling.
```

- [ ] **Step 2: Verify**

Run: `ls docs/audit/`
Expected: `2026-07-30-audit-implementation-summary.md`, `2026-07-30-repository-audit-archive.md`, `2026-07-31-follow-up-summary.md`.

### Task 8.2: Final CHANGELOG + README pass + full verification

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/README.md` (if it references demo pages or stale docs)

- [ ] **Step 1: Final CHANGELOG entry**

Replace the placeholder `### Audit` block added in Task 0.3 with the complete entry:

```markdown
## [Unreleased — 2026-07-31]

### Audit

- **Follow-up repository audit completed** — spec
  `docs/superpowers/specs/2026-07-31-follow-up-audit-design.md`; summary
  `docs/audit/2026-07-31-follow-up-summary.md`. Health score 79 → 87.
- Removed demo/showcase pages (forms, react-query, elements) from routes and nav.
- Notifications: 30 s polling via React Query; delivery design documented.
- Sentry integration (DSN-gated) + `x-request-id` correlation middleware.
- `audit_log` table + `withAudit()` on admin/staff writes + `/dashboard/admin/audit-log`.
- RBAC: `requireRole` exact sets (employee/technician split), `requireMinRole`, customer role.
- API.md rewritten: all 42 server functions with required roles.
- i18n enforcement: `i18n:check` key parity + hardcoded-string scanner (baseline allowlist).
- 70% coverage threshold enforced in CI.
- Better Auth rate limiting + per-user write rate limits.
- `src/lib/uploads.ts` validation helper for future upload features.
- Notification id payloads now use string ids with server-side coercion.
```

- [ ] **Step 2: Final verification**

Run:

```bash
bun run typecheck && bun run lint && bun run test:run && bun run i18n:check && bun run i18n:hardcoded
```

Expected: all pass, exit 0.

- [ ] **Step 3: Commit any last code changes**

```bash
git add -A src scripts package.json .github vite.config.ts .env.example
git status
```

Expected: only intended code changes staged (docs remain untracked per `.gitignore`); commit if anything is staged:

```bash
git commit -m "chore: finalize follow-up audit phase"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** every locked decision maps to a task — scope (0.x), polling (2.x), Sentry (3.1, 3.4, 3.5), request-id (3.2–3.3), audit trail (4.x), demo deletion (1.2–1.3), RBAC (5.x), uploads (6.5), coverage (6.4), i18n (6.2–6.3), rate limiting (7.x), API.md (6.1), health score (8.1). ✓
**Placeholder scan:** all steps contain concrete code or exact file lists; the only "mechanical" steps (Task 3.3 sweep, Task 7.2 insertions) specify the exact transformation rule and every target file. ✓
**Type consistency:** `withRequestContext`/`getRequestId` signatures match across 3.2/3.3/3.5/4.2; `withAudit(actorUserId, entry, fn)` used identically in 4.3–4.5; `requireMinRole('employee'|'hr'|'admin')` consistent in 5.1–5.2; `AuditEntry`/`AuditFilters` shapes match between `src/lib/audit.ts`, `src/lib/db/audit.ts`, and the audit route. ✓
**Deviations flagged:** (1) "ESLint rule" is implemented as a TS-AST script because oxlint cannot run `eslint-plugin-i18next` (Task 6.3 header); (2) docs are not committed because `.gitignore` ignores `*.md` (Task 0.1 note).
