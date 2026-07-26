# AGENTS.md — TanStack Dashboard

Agent-facing quick reference. Full project documentation:
- [PRD.md](./PRD.md) — Product requirements, features, security, roadmap
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Tech stack, data flow, patterns
- [API.md](./API.md) — Server function & auth reference
- [CHANGELOG.md](./CHANGELOG.md) — Notable changes
- [TODO.md](./TODO.md) — Task tracking

## Quick start

```bash
bun install
cp env.example.txt .env
bun run db:push    # apply DB schema
bun run db:seed    # seed 20 products + 1 demo user + 8 notifications + kanban +
                   #       2 locations + 3 shifts + 6 departments + 13 designations +
                   #       4 demo users + 4 employee records
bun run dev        # http://localhost:3000
bun run build      # client + server bundles
bun run start      # run built app from .output/
```

All `bun run` scripts (lint, format, typecheck, db:*) are defined in `package.json`.

## Project Structure

- `src/features/attendance/` — Check-in/out, leave, performance (Haversine geo-fencing)
- `src/features/masterdata/` — Departments & designations CRUD from UI
- `src/routes/dashboard/` — Conditional layout: `MobileShell` (mobile + staff role) vs sidebar layout
- `src/components/layout/` — Shared layout: sidebar, header, mobile-shell, bottom-nav, mobile-header

## Key files

- `src/lib/auth/auth-client.ts` — Uses `better-auth/react` (React-ready `useSession` hook)
- `src/lib/db/attendance.ts` — Attendance data access with Haversine
- `src/lib/db/masterdata.ts` — Masterdata CRUD
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
