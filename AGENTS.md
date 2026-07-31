# AGENTS.md — TanStack Dashboard

Agent-facing quick reference. Full project documentation:
- [README.md](./README.md) — Overview, features, quick start, deploy
- [docs/PRD.md](./docs/PRD.md) — Product requirements, features, security, roadmap
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Tech stack, data flow, patterns
- [docs/API.md](./docs/API.md) — Server function & auth reference
- [docs/CHANGELOG.md](./docs/CHANGELOG.md) — Notable changes
- [docs/TODO.md](./docs/TODO.md) — Task tracking

## Quick start

```bash
bun install
cp env.example.txt .env
bun run db:push    # apply DB schema
bun run db:seed    # seed 20 products + 1 demo user + 8 notifications + kanban +
                   #       2 locations + 3 shifts + 6 departments + 13 designations +
                   #       4 role groups (Administrator/HR/Employee/Technician) +
                   #       4 demo users + 4 employee records + customers
bun run dev        # http://localhost:3000
bun run build      # client + server bundles
bun run start      # run built app from .output/
```

All `bun run` scripts (lint, format, typecheck, db:*) are defined in `package.json`. For versioned schema changes instead of `db:push`, use `db:generate` → `db:migrate:run`.

## Project Structure

- `src/features/attendance/` — Check-in/out, leave, performance (Haversine geo-fencing)
- `src/features/customers/` — Customer CRUD with code generation
- `src/features/employees/` — Employee CRUD with department joins
- `src/features/masterdata/` — Departments & designations CRUD from UI
- `src/features/role-groups/` — RBAC role groups (permission matrix UI + queries)
- `src/routes/api/v1/` — Versioned API routes (`/api/v1/auth/$` for Better Auth)
- `src/routes/dashboard/` — Conditional layout: `MobileShell` (mobile + staff role) vs sidebar layout
- `src/components/layout/` — Shared layout: sidebar, header, mobile-shell, bottom-nav, mobile-header

## Key files

- `src/lib/auth/auth-client.ts` — Uses `better-auth/react` (React-ready `useSession` hook)
- `src/lib/auth/session.ts` — `requireSession()` / `requirePermission(module, action)` / `hasModulePermission`
- `src/lib/db/role-groups.ts` — Role group CRUD + `getUserRoleGroup`/`setUserRoleGroup` + `mapRoleGroupToLegacyRole`
- `src/hooks/use-nav.ts` — `useRoleGroupPermissions` (client permission map + nav filtering)
- `src/lib/db/attendance.ts` — Attendance data access with Haversine
- `src/lib/db/customers.ts` — Customer CRUD + customer code generation
- `src/lib/db/employees.ts` — Employee CRUD with joins
- `src/lib/db/masterdata.ts` — Masterdata CRUD
- `src/lib/errors.ts` — `DomainError` + `mapDbError` (standardized error handling)
- `src/lib/logger.ts` — Structured pino logger
- `src/lib/rate-limit.ts` — Rate limiter (returns HTTP 429 on exhaustion)
- `src/lib/api/version.ts` — `API_VERSION`/`API_PREFIX` for `/api/v1`
- `src/hooks/use-is-mobile.ts` — Responsive media query hook for mobile detection

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `Password123!` | admin |
| `hr@example.com` | `Password123!` | hr |
| `employee@example.com` | `Password123!` | employee |
| `technician@example.com` | `Password123!` | technician |

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
