# Follow-up Audit & Cleanup (2026-07-31)

## Problem

The 2026-07-30 audit (`docs/audit/2026-07-30-repository-audit.md`) is complete but left a second round of findings unaddressed. The new round covers observability, abuse protection, RBAC correctness, stale documentation, demo-page cleanup, i18n enforcement, a test-coverage baseline, and a notifications delivery decision. This spec **replaces** the 2026-07-30 plan; that doc is archived as historical.

## Principles

- **TanStack ecosystem first** — React Query polling before SSE/WebSocket; progressive enhancement; no over-engineering.
- **No regressions** — every phase keeps `bun run typecheck`, `bun run lint`, `bun run test:run` green; tests written before risky changes (RBAC semantics).
- **Fail-safe infrastructure** — Sentry, request-id, rate limiting all no-op / degrade gracefully when env vars are unset.
- **Single source of truth** — one current plan; stale docs updated or deleted, never left drifting.

## Current State (verified 2026-07-31)

| Area | State |
|---|---|
| Kanban | Fully removed from code/schema/routeTree/seed/.sql. Only stale reference: `docs/API.md` lines 41–47 (3 phantom functions). |
| Server functions | 42 actual (Products 5, Employees 5, Customers 5, Users 4, Notifications 5, Attendance 9, Masterdata 9). API.md documents 35: missing Employees + Customers, stale Kanban, wrong file path (`auth.ts` vs `auth.server.ts`), outdated `requireRole` snippet. |
| Rate limiting | `checkRateLimit` (in-memory, 100 req/60 s) only wired into `checkInFn`. Better Auth handler `/api/v1/auth/$` unrate-limited (no rate-limit plugin). |
| RBAC | `requireRole` hand-rolled hierarchy; `requireRole('employee')` and `requireRole('technician')` functionally identical (same allowed set). `permissions.ts` `createAccessControl` matrix unused. |
| Observability | pino only; no Sentry; `ErrorBoundary` uses `console.error`; no request-id correlation; no `defaultErrorComponent` in router; per-route `ErrorBoundary`/`pendingComponent` unused. |
| Notifications | Pure pull via `useQuery`; no `refetchInterval`, no SSE/WS. |
| File upload | `FileUploader` client-side only; only real consumer `product-form.tsx` has dead UI (file never sent); real upload fn lives in demo-only `demo-form.tsx`. |
| i18n | EN/ID 128↔128 key-parity; most components use hardcoded English (adoption gap). |
| Tests | Vitest + Playwright, 239 passing, no coverage threshold. Auth guards and rate-limit have ~no coverage. |
| Audit trail | None (no record of admin write actions). |

## Design Decisions (locked)

1. **Scope:** Replace the 2026-07-30 plan entirely; archive the old doc.
2. **Notifications:** React Query polling — `refetchInterval: 30_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus`, `staleTime: 15_000`, mutation-driven invalidation, "new since last seen" indicator. Documented SSE upgrade path.
3. **Observability:** Sentry (`@sentry/tanstackstart-react` + `@sentry/node`) gated by `SENTRY_DSN` (no-op when unset); request-id middleware feeding pino child logger + Sentry tags + response header; `ErrorBoundary.componentDidCatch` → Sentry; `defaultErrorComponent` in router; per-route error-boundary + `<LoadingSkeleton />` standard documented in ARCHITECTURE.md.
4. **Audit trail:** New `audit_log` DB table + `withAudit()` helper (same-transaction snapshot writes) + admin-only route `/dashboard/admin/audit-log`.
5. **Demo pages:** Delete all 6 routes + `Elements` nav group + demo feature dirs + unused upload components; remove `react-dropzone` dep.
6. **RBAC:** Keep role-based. Fix `requireRole` sets (separate technician/employee); add `requireMinRole` with JSDoc; reconcile `Role` type vs `permissions.ts` (customer); keep `createAccessControl` as documented-future fine-grained source.
7. **Uploads:** Remove dead `FormFileUploadField` from `product-form.tsx`; add reusable `src/lib/uploads.ts` (`validateUpload` Zod helper + `withUpload` wrapper) for the next uploader feature.
8. **Test baseline:** Enforce 70% lines/branches/functions/statements via `vitest.config.ts` coverage thresholds + CI.
9. **i18n enforcement:** `scripts/check-i18n.ts` key-parity check (fails on EN/ID divergence) + ESLint rule forbidding hardcoded JSX text in `src/routes/**` and `src/features/**/components/**`.

## Architecture

### audit_log table

```
audit_log (
  id serial PK,
  actor_user_id text NOT NULL REFERENCES user.id,
  action text NOT NULL,          -- e.g. 'user.role.changed', 'employee.deleted'
  entity_type text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
)
```

- Append-only, no updates/deletes (integrity).
- `withAudit({ action, entityType, before, after }, fn)` writes the row in the same transaction as the mutation.
- Actor + request_id sourced from a session/request helper shared with the request-id middleware.
- Queryable via the data-table primitive in the admin audit-log route.

### Request-id + logging flow

```
request → requestIdMiddleware (X-Request-Id gen/echo, pino child, Sentry tag)
  → server function handler
    → mapDbError / DomainError → logger.error + Sentry.captureException (guarded)
  → response headers carry X-Request-Id
```

### Notifications data flow

```
mutation (markAsRead/markAllAsRead/addNotification/remove)
  → queryClient.invalidateQueries(notificationKeys.all)
  → polling query refetches every 30s while tab visible
  → "new since last seen" derived from localStorage last_seen
```

### RBAC helpers (src/lib/auth/session.ts)

- Sets: `adminSet = ['admin']`, `hrSet = ['admin','hr']`, `employeeSet = ['admin','hr','employee']`, `technicianSet = ['admin','hr','technician']`.
- `requireRole(role)` — exact membership per set.
- `requireMinRole(min)` — at-least hierarchy (`employee` < `technician` < `hr` < `admin`).
- JSDoc on both clarifying semantics (audit 1.4).

## Phases

| Phase | Scope | Size |
|---|---|---|
| 0 | Archive 2026-07-30 audit; rewrite TODO.md as single source of truth; CHANGELOG entry | XS |
| 1 | Remove Kanban section from API.md; delete 6 demo routes + `Elements` nav group + demo feature dirs + unused `FileUploader`/`FileUploadField`/`file-preview` + `react-dropzone` dep; remove dead upload field from `product-form.tsx`; fix notification `id: number` → `string` type drift; prune i18n demo keys; regression tests (no Elements group, no demo routes) | S |
| 2 | Notifications polling (`refetchInterval` etc.), mutation invalidation, last-seen indicator, fake-timer test, `docs/NOTIFICATIONS.md` with SSE migration path | S |
| 3 | Sentry init (DSN-gated), request-id middleware + pino child, `ErrorBoundary` → Sentry, `defaultErrorComponent`, per-route error boundary + skeleton standard on 4 priority routes, `mapDbError` Sentry hook, unit tests (request-id, ErrorBoundary) | M |
| 4 | `audit_log` migration + schema export, `withAudit()` helper, wire into all admin write server functions, admin audit-log route, integration + access tests | M |
| 5 | RBAC fix (separate sets), `requireMinRole`, role-type reconciliation, permissions.ts header comment, full unit-test matrix (currently 0) | S |
| 6 | API.md rewrite (all 42 functions + required roles), `scripts/check-i18n.ts` + `bun run i18n:check` + lint/CI wiring, ESLint hardcoded-string rule, 70% coverage thresholds, `src/lib/uploads.ts` helper | M |
| 7 | Better Auth `rateLimit` config, `checkRateLimit` on public/authenticated write fns, `.env.example` knobs, extended rate-limit tests | S |
| 8 | Re-run health-score rubric, `docs/audit/2026-07-31-follow-up-summary.md`, CHANGELOG + README updates | XS |

## Error Handling

- All new infra fails soft: Sentry init wrapped (no DSN → `logger.warn`, continue); request-id middleware never throws on generation; rate-limit exhaustion already returns 429 via `setResponseStatus`.
- `withAudit` failure must not roll back the business mutation silently — it logs and rethrows `DomainError` only if the underlying `fn` threw; audit write failures are logged (append-only, non-critical path).
- Upload helper rejects with `DomainError('UPLOAD_INVALID')`.

## Testing

- **Before risky changes (TDD):** RBAC guard matrix (Phase 5) written first; rate-limit extension tests (Phase 7); coverage-threshold raise preceded by coverage-gap fixes (Phase 6).
- **New unit tests:** request-id middleware (gen/echo/uniqueness), ErrorBoundary → Sentry (mocked), notification polling via fake timers, nav-config regression, uploads helper validation matrix.
- **New integration tests:** audit_log write on admin mutations + before/after snapshots + actor; admin-only route access.
- **CI:** existing workflow runs lint, typecheck, test:run, build; add `i18n:check` and coverage-threshold enforcement.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `requireRole('technician')` semantic change breaks callers relying on old behaviour | grep all call sites before change; TDD matrix first; review in its own commit |
| Demo deletion is irreversible without git | dedicated commit; restore from history if stakeholders object |
| Coverage threshold fails CI on first run | measure first; fix gaps before enabling threshold |
| Sentry SDK throws without DSN | guarded init; no-op path verified in dev |
| audit_log migration on live DB | follows existing `db:generate` → `db:migrate:run` workflow; append-only table |
| ESLint i18n rule too noisy on existing code | scope to `src/routes/**` + feature components; allowlist `aria-*`/sr-only/numbers; fix existing violations in Phase 6 (they are few — components mostly use hardcoded strings, flagged by audit) |

## Out of Scope (deferred)

- WhatsApp notification channel, payroll, reporting, customer self-service portal.
- Migration of `permissions.ts` to active per-entity guards.
- Generic live upload endpoint/storage.
- SSE/WebSocket (until a sub-second workflow exists; documented trigger in NOTIFICATIONS.md).
