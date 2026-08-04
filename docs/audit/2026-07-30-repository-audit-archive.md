> **ARCHIVED 2026-07-31.** Superseded by the follow-up audit: see
> `docs/superpowers/specs/2026-07-31-follow-up-audit-design.md` and
> `docs/superpowers/plans/2026-07-31-follow-up-audit.md`. The 2026-07-30
> phased plan is replaced entirely; its completed items live on in the
> CHANGELOG, its remaining gaps are covered by the new plan.

# Repository Audit

Date: 2026-07-30
Auditor: OpenCode (automated analysis)

## Project Overview

**Kolonios** — ISP/property management admin dashboard built with TanStack Start, React 19, shadcn/ui, Tailwind CSS v4, and PostgreSQL. Targets SaaS admin panels with attendance tracking, customer/employee management, inventory, and Kanban task management.

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Meta-framework | TanStack Start | v1.168.27 |
| UI | React | v19.0.0 |
| Build | Vite | v7.x |
| Server | Nitro (production) | v3.x |
| Language | TypeScript | v5.7.2 |
| ORM | Drizzle ORM | v0.45.2 |
| Database | PostgreSQL | 17 |
| Auth | Better Auth | v1.6.23 |
| State | TanStack React Query | v5.101.2 |
| Forms | TanStack Form | v1.33.0 |
| Validation | Zod | v4.3.6 |
| CSS | Tailwind CSS | v4.3.1 |
| Testing | Vitest + Playwright | v4.1.10 + v1.61.1 |
| Linting | oxlint | v1.59.0 |
| Formatting | oxfmt | v0.44.0 |

### Project Structure

```
src/
├── features/       # 12 feature modules (attendance, auth, customers, employees, etc.)
├── components/     # Shared UI (60+ shadcn/ui primitives, layout, themes, kbar)
├── lib/            # Core library (auth, db, errors, utils, parsers)
├── routes/         # File-based routing (TanStack Router, ~31 files)
├── hooks/          # Custom hooks (10 files)
├── i18n/           # Internationalization (EN/ID)
├── config/         # Navigation, data-table config
├── styles/         # Global CSS & themes
└── types/          # TypeScript types
```

## Architecture Review

### Strengths

- **Feature-sliced architecture** — Consistent across all modules. Each feature has `api/{service,queries,mutations,types,validation}` + `components/`.
- **Server function pattern** — Dynamic `import()` inside `createServerFn()` handlers keeps `postgres` driver out of client bundles. Applied uniformly.
- **RPC boundary authz** — Every server function calls `requireSession()` or `requireRole()`. Route-level `beforeLoad` guards are secondary.
- **React Query + SSR hydration** — `setupRouterSsrQueryIntegration` + `ssr: 'data-only'` provides correct cache-first hydration.
- **Error handling** — `mapDbError` + `DomainError` provides consistent error boundaries at the DB layer.

### Weaknesses

- **Test coverage is uneven** — 3 data-access modules tested (products, notifications, parsers). 5+ modules have zero tests (attendance, customers, employees, masterdata, auth).
- **Type-safety gaps** — `users.ts` uses `any` casts throughout. Some `mapDbError` callers discard the return type.
- **Schema drift risk** — Attendance types (`LeaveType`, `AttendanceStatus`, etc.) defined in 3 places: schema enums, feature type unions, and Zod validation.

## Security Assessment

### Critical (0)
No critical security vulnerabilities found.

### High (1)
**1.1 `customers.customer_code` race condition**
- `src/lib/db/customers.ts:55-58`
- `generateCustomerCode()` uses `SELECT count(*) + 1` — race-prone under concurrent inserts.
- Unique constraint catches it, but `mapDbError` turns the constraint violation into generic 500.
- **Fix:** Use PostgreSQL sequence or `SELECT ... FOR UPDATE`.

### Medium (3)
**1.2 `notifications.user_id` nullable**
- `src/lib/db/schema/notifications.ts:12` — no `.notNull()` constraint.
- Orphaned notifications cannot be managed.
- **Fix:** Add `.notNull()` + FK to `user.id`.

**1.3 `any` casts in `users.ts`**
- `src/lib/db/users.ts:1` — `eslint-disable @typescript-eslint/no-explicit-any`
- `Math.random().toString(36).slice(-12)` for password generation is not crypto-secure.
- **Fix:** Use Better Auth's own password utilities; type API responses properly.

**1.4 `requireRole('employee')` ambiguity**
- `src/lib/auth/session.ts:31` — `requireRole` implies exact match, but the implementation checks a minimum-role hierarchy. Intent is undocumented.
- **Fix:** Rename to `requireMinRole` or add JSDoc.

## Code Quality

### Duplication (Medium)

- **`parseSort`** identical in `products.ts:21`, `customers.ts:12`, `employees.ts:12` — should live in `lib/parsers.ts` alongside `parseSortingState`.
- **Two mobile-detection hooks** — `use-is-mobile.ts` (matchMedia) and `use-mobile.tsx` (shadcn sidebar). Different breakpoint logic may produce inconsistent layout decisions.
- **Two debounce hooks** — `use-debounce.tsx` (value) and `use-debounced-callback.ts` (function). Intentional but verify no overlap.

### Type Safety (Medium)

- **`noUnusedLocals: false`** and **`noUnusedParameters: false`** in `tsconfig.json` allow dead variables to accumulate silently.
- **`employees.serialize()`** accepts a manually typed object instead of `typeof employees.$inferSelect & { department_name: ... }`.
- **`locations.status`** uses `text` instead of a proper `pgEnum`.
- **Attendance type unions** (`AttendanceStatus`, `LeaveType`, `LeaveStatus`) defined by hand in `api/types.ts` when they could be derived from schema enums.

### Naming & Stale Strings (Low)

- `sidebar.tsx:49` says "TanStack Start" — project renamed to Kolonios.
- `nav-config.ts` has `isActive: false` on every nav item — sidebar overrides this via `pathname`.
- `seed.ts:20` includes `'customer'` in `ROLES` — not a valid app role.
- Forms demo pages (`/dashboard/forms/*`) registered in production navigation but are scaffolding.

## Database Schema

### `updated_at` Inconsistency (Medium)

| Table | `updated_at` auto-update? |
|-------|--------------------------|
| `user` | Yes (`.$onUpdate()`) |
| `session` | Yes |
| `account` | Yes |
| `verification` | Yes |
| `products` | No (manual) |
| `notifications` | No (manual) |
| `customers` | No (manual) |
| `employees` | No (manual) |
| `masterdata.*` | No (manual) |

Not all callers pass `updated_at: new Date()`. Schema should use `.$onUpdate()` consistently.

### Other Schema Issues

- `locations.status` uses `text` not an enum.
- `notifications.user_id` lacks `notNull()` + FK.
- Customers table uses user `id` as PK — one user = one customer constraint.
- Migration system: only one migration file (`0000_lethal_goliath.sql`), and development uses `db:push` which bypasses it.

## Test Coverage

### What's Tested (6 files)

| File | Type | Quality |
|------|------|---------|
| `src/lib/db/products.test.ts` | Integration | Excellent — 14 tests |
| `src/lib/db/notifications.test.ts` | Integration | Excellent — 9 tests, IDOR isolation |
| `src/lib/parsers.test.ts` | Unit | Good — 6 tests |
| `src/lib/db/schema/products.test.ts` | Schema | Good — 6 tests |
| `src/features/users/schemas/user.test.ts` | Schema | Unknown |
| `src/features/products/schemas/product.test.ts` | Schema | Unknown |

### What's Not Tested

- **`src/lib/db/attendance.ts`** — Haversine distance, check-in/out, leave requests
- **`src/lib/db/customers.ts`** — CRUD, code generation
- **`src/lib/db/employees.ts`** — CRUD with joins
- **`src/lib/db/masterdata.ts`** — Department/designation CRUD
- **`src/lib/db/users.ts`** — User management
- **`src/lib/auth/session.ts`** — `requireRole` / `requireSession`
- **All validation schemas** in `src/features/*/api/validation.ts`
- **E2E** — Only products + themes covered; gaps in auth, attendance, customers, employees, notifications

## i18n

- Framework well set up with typed `TranslationKey` derived from EN JSON
- **Partial adoption** — Most UI components use hardcoded English strings, not `useTranslation()`
- Mixed approach gives false impression of i18n readiness

## Priority Improvement Plan

### Critical (fix before feature development)

| # | Issue | File | Effort |
|---|-------|------|--------|
| 1 | Data integrity tests for attendance/customers/employees/masterdata | Multiple | Large |
| 2 | `notifications.user_id` nullable | `schema/notifications.ts` | XS |

### High

| # | Issue | File | Effort |
|---|-------|------|--------|
| 3 | `generateCustomerCode` race condition | `customers.ts` | Small |
| 4 | `updated_at` auto-update missing | All schema files | Small |
| 5 | E2E coverage gaps | `e2e/` | Large |

### Medium

| # | Issue | File | Effort |
|---|-------|------|--------|
| 6 | `parseSort` duplication | 3 files | XS |
| 7 | Attendance types triple-defined | `types.ts`, `schema.ts`, `validation.ts` | Small |
| 8 | Two mobile-detection hooks | `hooks/` | XS |
| 9 | `users.ts` `any` casts + insecure password gen | `users.ts` | Small |
| 10 | i18n partial adoption | All components | XL |

### Low

| # | Issue | File | Effort |
|---|-------|------|--------|
| 11 | `noUnusedLocals/Params` off | `tsconfig.json` | XS |
| 12 | "TanStack Start" in sidebar | `app-sidebar.tsx` | XS |
| 13 | `isActive: false` dead field | `nav-config.ts` | XS |
| 14 | `locations.status` uses text not enum | `schema/attendance.ts` | Small |
| 15 | Forms demos in production nav | `nav-config.ts` | XS |

## Health Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Code Quality | 75/100 | Consistent patterns, some duplication, type-safety gaps |
| Architecture | 85/100 | Well-structured feature modules, server-function pattern is sound |
| Security | 80/100 | No critical issues, RBAC solid, minor gaps (nullable, sequel race) |
| Performance | 85/100 | Dynamic imports, proper SSR hydration, no N+1, good DB query patterns |
| Maintainability | 70/100 | Clear structure but uneven test coverage slows refactoring |
| Scalability | 75/100 | Feature-based structure scales well; migration system needs production attention |
| Test Coverage | 40/100 | Only 6 test files; critical attendance/customers/employees/auth uncovered |
| Documentation | 85/100 | Excellent PRD, ARCHITECTURE, API, CHANGELOG, ATTENDANCE, MOBILE docs |
| Overall | 74/100 | Healthy codebase ready for continued development with targeted quality investment |

## Conclusion

**Should new feature development proceed?** Yes — with the following conditions:

1. **Before any new feature work**, fix the 2 critical items (test gaps + nullable `user_id`) in the same session.
2. **During the next feature cycle**, address the top mid/high items: race condition, `updated_at` consistency, `parseSort` dedup, mobile-hook consolidation.
3. **Defer** i18n full adoption and forms-demo removal to a dedicated cleanup pass.

The codebase has strong foundational architecture (feature slicing, server functions, RBAC, React Query + SSR hydration). The test framework is proven (Vitest + test-utils pattern works for products/notifications). Extending coverage to the untested modules is straightforward and should be the highest priority to prevent regression.

## Refactoring Roadmap

### Phase 1 — Quick Wins (1-2 sessions)
- Add `.notNull()` + FK to `notifications.user_id`
- Extract `parseSort` into `lib/parsers.ts`
- Consolidate mobile-detection hooks
- Enable `noUnusedLocals`/`noUnusedParameters` and fix flags
- Fix "TanStack Start" → Kolonios in sidebar

### Phase 2 — Data Integrity (2-3 sessions)
- Add `.$onUpdate(() => new Date())` to all schema `updated_at` columns
- Fix `generateCustomerCode` race condition (use sequence)
- Add NOT NULL + FK constraints where missing
- Mark `mapDbError` return type as `never` for correct TS narrowing

### Phase 3 — Test Coverage (3-4 sessions)
- Write integration tests for attendance (Haversine, check-in/out, leave)
- Write integration tests for customers and employees CRUD
- Write integration tests for masterdata
- Write unit tests for all validation schemas
- Write E2E tests for auth, attendance, customers, employees

### Phase 4 — Type Safety (2-3 sessions)
- Remove `any` casts from `users.ts`
- Derive attendance type unions from schema enums
- Refactor `employees.serialize()` to use schema inference
- Audit and fix `mapDbError` return type issues

### Phase 5 — i18n / Polish (dedicated sprint)
- Convert hardcoded strings throughout all feature components
- Create missing translation keys in EN/ID JSON
- Gate forms demo pages behind env flag
