# Audit Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 10 recommendations from the 2026-07-30 repository audit to improve code quality, security, testing, and developer experience.

**Architecture:** Each recommendation will be implemented as a separate task using Test-Driven Development. New utility modules will be created, existing code refactored, tests added, and CI/CD configured. The codebase uses feature-sliced architecture; we will follow existing patterns.

**Tech Stack:** Bun, TypeScript, Vitest, Playwright, Drizzle ORM, TanStack Start, React 19, Tailwind CSS v4, Zod.

## Global Constraints

- Use Bun for all scripts (`bun run <script>`).
- Use TypeScript strict mode.
- Use Zod for validation.
- Use Drizzle ORM for database access.
- Use TanStack Router for routing.
- Use React Query for data fetching.
- Follow existing code style: `oxlint` and `oxfmt`.
- Run `bun run lint`, `bun run typecheck`, `bun run test:run`, and `bun run format:check` after each change.
- Use `simple-git-hooks` pre-commit hooks.
- Do not modify `package.json` dependencies without justification.
- All new modules must have corresponding tests.
- Use `bun run test:run` to run unit tests, `bun run e2e` for E2E tests.
- Use `bun run db:push` for development, but plan for `db:migrate` workflow.

---

## Task 1: Standardize error handling

**Files:**
- Modify: `src/lib/errors.ts`
- Create: `src/lib/errors.test.ts`

**Interfaces:**
- Consumes: existing error patterns (`throw new Error('...')`, `mapDbError`).
- Produces: a standardized `DomainError` class with error codes, used across the codebase.

- [ ] **Step 1: Write failing test for `mapDbError`**

Create `src/lib/errors.test.ts` with the following content:

```ts
import { describe, it, expect } from 'vitest';
import { DomainError, mapDbError } from './errors';

describe('mapDbError', () => {
  it('rethrows DomainError', () => {
    const original = new DomainError('test', 'TEST_CODE');
    expect(() => mapDbError(original, 'ctx')).toThrow(DomainError);
  });

  it('wraps unknown error in DomainError with INTERNAL_ERROR code', () => {
    expect(() => mapDbError(new Error('boom'), 'ctx')).toThrowError(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `bun run test:run src/lib/errors.test.ts`
Expected: FAIL because `DomainError` does not have a `code` property.

- [ ] **Step 3: Update `src/lib/errors.ts`**

Replace the contents of `src/lib/errors.ts` with:

```ts
export class DomainError extends Error {
  constructor(message: string, public code: string = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
  }
}

export function mapDbError(error: unknown, context: string): never {
  if (error instanceof DomainError) throw error;
  console.error(`[db:${context}]`, error);
  throw new DomainError('An internal error occurred. Please try again.', 'INTERNAL_ERROR');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/errors.test.ts`
Expected: PASS

- [ ] **Step 5: Refactor one data access file to use the new error utility**

Edit `src/lib/db/products.ts` (or any other data access file) to use `mapDbError` and throw `DomainError` where appropriate. Ensure existing tests pass.

- [ ] **Step 6: Run all tests to ensure no regression**

Run: `bun run test:run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/errors.ts src/lib/errors.test.ts src/lib/db/products.ts
git commit -m "feat(errors): standardize error handling with DomainError and mapDbError"
```

---

## Task 2: Add loading states with skeleton components

**Files:**
- Create: `src/components/ui/loading-skeleton.tsx`
- Create: `src/components/ui/loading-skeleton.test.tsx`
- Modify: `src/routes/dashboard/index.tsx` (or any page) to show skeleton during data fetch.

**Interfaces:**
- Consumes: existing `Skeleton` component.
- Produces: a `<LoadingSkeleton />` wrapper for routes.

- [ ] **Step 1: Create the loading skeleton component**

Create `src/components/ui/loading-skeleton.tsx`:

```tsx
import { Skeleton } from './skeleton';

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className='space-y-2'>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className='h-12 w-full' />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write a test for the component**

Create `src/components/ui/loading-skeleton.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingSkeleton } from './loading-skeleton';

describe('LoadingSkeleton', () => {
  it('renders the specified number of skeleton rows', () => {
    const { container } = render(<LoadingSkeleton rows={3} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

Run: `bun run test:run src/components/ui/loading-skeleton.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/components/ui/loading-skeleton.test.tsx`
Expected: PASS

- [ ] **Step 5: Use `LoadingSkeleton` in a page**

Edit `src/routes/dashboard/index.tsx` to show `<LoadingSkeleton />` while data is loading (e.g., wrap the table in a Suspense boundary or use React Query's `isLoading`).

- [ ] **Step 6: Run lint and typecheck**

Run: `bun run lint && bun run typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/loading-skeleton.tsx src/components/ui/loading-skeleton.test.tsx src/routes/dashboard/index.tsx
git commit -m "feat(ui): add LoadingSkeleton component for data fetching states"
```

---

## Task 3: Improve test coverage for critical modules

**Files:**
- Create: `src/lib/db/attendance.test.ts`
- Create: `src/lib/db/customers.test.ts`
- Create: `src/lib/db/employees.test.ts`
- Create: `src/lib/db/masterdata.test.ts`
- Create: `src/features/attendance/api/validation.test.ts`
- Create: `src/features/customers/api/validation.test.ts`
- Create: `src/features/employees/api/validation.test.ts`
- Create: `src/features/masterdata/api/validation.test.ts`

**Interfaces:**
- Consumes: existing data access functions and validation schemas.
- Produces: integration tests covering CRUD, Haversine distance, and validation rules.

- [ ] **Step 1: Write test for Haversine distance in attendance**

Create `src/lib/db/attendance.test.ts` with a test that verifies the Haversine distance calculation between two known coordinates.

- [ ] **Step 2: Run test to confirm it fails**

Run: `bun run test:run src/lib/db/attendance.test.ts`
Expected: FAIL because test file does not exist.

- [ ] **Step 3: Write the test code**

Add the test using the existing `calculateDistance` function (if exported) or create a helper.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/db/attendance.test.ts`
Expected: PASS

- [ ] **Step 5: Repeat for other modules**

Write tests for `customers`, `employees`, `masterdata`, and validation schemas. Follow the same pattern: write failing test, run, implement if needed, run to pass.

- [ ] **Step 6: Run all tests**

Run: `bun run test:run`
Expected: All tests pass, coverage increases.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/attendance.test.ts src/lib/db/customers.test.ts src/lib/db/employees.test.ts src/lib/db/masterdata.test.ts src/features/*/api/validation.test.ts
git commit -m "test: add integration and validation tests for critical modules"
```

---

## Task 4: Add API versioning

**Files:**
- Create: `src/lib/api/version.ts`
- Create: `src/lib/api/version.test.ts`
- Modify: `src/routes/api/` (add version prefix)
- Modify: `src/lib/server.ts` (if exists) to mount versioned routes.

**Interfaces:**
- Consumes: existing server functions.
- Produces: API routes prefixed with `/api/v1/`.

- [ ] **Step 1: Create version constant**

Create `src/lib/api/version.ts`:

```ts
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
```

- [ ] **Step 2: Write test for version export**

Create `src/lib/api/version.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { API_PREFIX, API_VERSION } from './version';

describe('API version', () => {
  it('exports v1 prefix', () => {
    expect(API_VERSION).toBe('v1');
    expect(API_PREFIX).toBe('/api/v1');
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

Run: `bun run test:run src/lib/api/version.test.ts`
Expected: FAIL

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/api/version.test.ts`
Expected: PASS

- [ ] **Step 5: Update server routes to use the prefix**

Modify the route registration in `src/routes/api/index.ts` (or similar) to mount all routes under `API_PREFIX`.

- [ ] **Step 6: Run lint and typecheck**

Run: `bun run lint && bun run typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/version.ts src/lib/api/version.test.ts src/routes/api/
git commit -m "feat(api): add API versioning with /api/v1 prefix"
```

---

## Task 5: Add logging/monitoring

**Files:**
- Create: `src/lib/logger.ts`
- Create: `src/lib/logger.test.ts`
- Modify: `src/lib/errors.ts` to use logger.

**Interfaces:**
- Consumes: existing `console.error` calls.
- Produces: a structured logger (e.g., using `pino`) and monitoring hooks.

- [ ] **Step 1: Install `pino` and `pino-pretty`**

Run: `bun add pino pino-pretty`
Expected: Dependencies added to `package.json`.

- [ ] **Step 2: Create logger module**

Create `src/lib/logger.ts`:

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});
```

- [ ] **Step 3: Write test for logger**

Create `src/lib/logger.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  it('exports a logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });
});
```

- [ ] **Step 4: Run test to confirm it fails**

Run: `bun run test:run src/lib/logger.test.ts`
Expected: FAIL

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:run src/lib/logger.test.ts`
Expected: PASS

- [ ] **Step 6: Replace `console.error` in `src/lib/errors.ts` with `logger.error`**

Update `src/lib/errors.ts` to import and use `logger.error` instead of `console.error`.

- [ ] **Step 7: Run all tests**

Run: `bun run test:run`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add package.json src/lib/logger.ts src/lib/logger.test.ts src/lib/errors.ts
git commit -m "feat(logging): add structured logger and integrate with errors"
```

---

## Task 6: Document environment variables

**Files:**
- Create: `.env.example`

**Interfaces:**
- Consumes: `process.env` usage in the codebase.
- Produces: a documented list of all required environment variables.

- [ ] **Step 1: Search codebase for `process.env`**

Run: `rg "process\.env" src/`
Expected: List of all environment variables used.

- [ ] **Step 2: Create `.env.example`**

Add the following content (adjust as needed):

```env
# Database
DATABASE_URL=postgres://user:password@localhost:5432/dbname

# Auth
BETTER_AUTH_SECRET=replace-me-with-a-strong-secret
BETTER_AUTH_URL=http://localhost:3000

# Logging
LOG_LEVEL=info

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

- [ ] **Step 3: Verify `.env.example` is ignored in git (should be committed)**

Ensure `.env` is in `.gitignore` (should already be), and `.env.example` is tracked.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example with all required environment variables"
```

---

## Task 7: Add database migration workflow

**Files:**
- Create: `scripts/migrate.ts`
- Modify: `package.json` to add `db:migrate:run` script.

**Interfaces:**
- Consumes: Drizzle migration files in `src/lib/db/migrations/`.
- Produces: a script that runs migrations on startup or via CLI.

- [ ] **Step 1: Create migration runner script**

Create `scripts/migrate.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connection = postgres(process.env.DATABASE_URL || '');
const db = drizzle(connection);

async function main() {
  await migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  console.log('Migrations applied');
  await connection.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script to `package.json`**

Add to `scripts`:
```json
"db:migrate:run": "bun run scripts/migrate.ts"
```

- [ ] **Step 3: Test migration script**

Run: `bun run db:migrate:run`
Expected: Migrations applied successfully (if DB is available).

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate.ts package.json
git commit -m "feat(db): add migration runner script"
```

---

## Task 8: Implement rate limiting

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `src/lib/rate-limit.test.ts`
- Modify: `src/lib/auth/session.ts` (or create a middleware) to apply rate limiting.

**Interfaces:**
- Consumes: request context from server functions.
- Produces: a rate limit middleware that returns 429 when exceeded.

- [ ] **Step 1: Install `rate-limiter-flexible`**

Run: `bun add rate-limiter-flexible`

- [ ] **Step 2: Create rate limit module**

Create `src/lib/rate-limit.ts`:

```ts
import { RateLimiterMemory } from 'rate-limiter-flexible';

export const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10) / 1000
});

export async function checkRateLimit(key: string) {
  try {
    await rateLimiter.consume(key);
  } catch {
    throw new Error('Rate limit exceeded');
  }
}
```

- [ ] **Step 3: Write test for rate limit**

Create `src/lib/rate-limit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkRateLimit } from './rate-limit';

describe('checkRateLimit', () => {
  it('allows requests under the limit', async () => {
    await expect(checkRateLimit('test-key')).resolves.not.toThrow();
  });

  it('throws after exceeding limit', async () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 100; i++) {
      await checkRateLimit(key);
    }
    await expect(checkRateLimit(key)).rejects.toThrow('Rate limit exceeded');
  });
});
```

- [ ] **Step 4: Run test to confirm it fails**

Run: `bun run test:run src/lib/rate-limit.test.ts`
Expected: FAIL

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:run src/lib/rate-limit.test.ts`
Expected: PASS

- [ ] **Step 6: Apply rate limit in a server function**

Edit one server function (e.g., a login mutation) to call `checkRateLimit` with a unique key (e.g., IP address).

- [ ] **Step 7: Run all tests**

Run: `bun run test:run`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add package.json src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "feat(security): add rate limiting to server functions"
```

---

## Task 9: Add CI/CD pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: existing scripts (`lint`, `typecheck`, `test:run`, `build`).
- Produces: a GitHub Actions workflow that runs on push and PR.

- [ ] **Step 1: Create workflow file**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bun run lint
      - run: bun run typecheck
      - run: bun run test:run
      - run: bun run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint, typecheck, test, build"
```

---

## Task 10: Review unused dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: current dependencies.
- Produces: a cleaned `package.json` with unused packages removed.

- [ ] **Step 1: Identify unused dependencies**

Run: `bun run lint` and `bun run typecheck` to see if any imports are missing.
Run: `rg "from 'package-name'" src/` to find usage.
Check for packages that are not imported anywhere.

- [ ] **Step 2: Remove unused dependencies**

For each identified package, run: `bun remove <package-name>`

- [ ] **Step 3: Verify build still works**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: remove unused dependencies"
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-30-audit-recommendations.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
