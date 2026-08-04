# Attendance Residual Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the residual attendance, timezone, XLSX dependency, HR permission, and test-coverage findings without changing deferred MVP behavior.

**Architecture:** Keep attendance data access and export behavior stable. Introduce a pure business-date helper, reset checkout selfie UI state after successful checkout, isolate XLSX behind an export adapter using the official SheetJS distribution, keep HR `attendance.edit`, and repair/add tests. Documentation and process notes are updated to match.

**Tech Stack:** TypeScript, TanStack Start server functions, drizzle-orm/postgres, vitest, Playwright, SheetJS official distribution, date-fns.

## Global Constraints

- No push to `origin/main`; verification is local only. (Spec: Out of Scope)
- HR retains full `attendance.edit` permission. Do not change role group seed or permission checks.
- Schedule policy overrides remain deferred. Do not implement them.
- MapLibre wrapper stays as-is; do not migrate to mapcn.
- Business timezone default is `Asia/Jakarta` (WIB, UTC+7), configurable via app settings.
- Do not restore `react-dropzone` or any removed product upload flow.
- Do not revert or rewrite existing user documentation changes in the worktree.
- `*.md` files are gitignored; commit docs with `git add -f` only when the plan explicitly requires it.

---
## File Structure

- `src/lib/dates.ts` — Create: pure `businessDateInTimeZone(now, timeZone)` helper returning `YYYY-MM-DD` via `Intl.DateTimeFormat`.
- `src/lib/dates.test.ts` — Create: unit tests for boundary behavior in `Asia/Jakarta` and `UTC`.
- `src/lib/db/attendance.ts:88` — Modify: `getEmployeeAttendance` default date uses the business-date helper with the configured/default timezone.
- `src/lib/db/attendance.test.ts` — Modify: add test that default date resolves in business timezone (explicit date path remains unchanged).
- `src/features/attendance/api/export-adapter.ts` — Create: XLSX adapter (SheetJS official import + `writeXlsxBuffer`), plus CSV/PDF helpers if extracted.
- `src/features/attendance/api/export-adapter.test.ts` — Create: unit tests for `writeXlsxBuffer`.
- `src/features/attendance/api/service.ts:543-556` — Modify: xlsx branch delegates to the adapter.
- `package.json` — Modify: replace `xlsx: ^0.18.5` with official SheetJS distribution.
- `src/features/attendance/components/attendance-check-card.tsx` — Modify: clear `checkOutSelfie` after successful checkout.
- `src/features/attendance/components/attendance-check-card.test.tsx` — Create: unit test for checkout selfie reset (component test with mocked mutation).
- `e2e/attendance-employee.spec.ts` — Modify: add checkout selfie e2e coverage.
- `e2e/product-crud.spec.ts` — Modify: re-enable CRUD tests matching current product form (no upload).
- `src/test-utils/db.ts` — Modify: expose a seed helper for checkout-ready records if needed by e2e (see Task 6; otherwise not touched).
- `docs/CHANGELOG.md`, `docs/TODO.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/ATTENDANCE.md`, `docs/PRD.md` — Modify: residual/deferred items and decisions.
- `README.md` — Modify: add manual migration DB sync workflow note (only if it does not conflict with existing user edits).

---

## Task 1: Business date helper and attendance default date

**Files:**
- Create: `src/lib/dates.ts`
- Create: `src/lib/dates.test.ts`
- Modify: `src/lib/db/attendance.ts:86-108` (default date line 88)
- Modify: `src/lib/db/attendance.test.ts` (add one default-date test)

**Interfaces:**
- Produces: `businessDateInTimeZone(now: Date | number | string, timeZone?: string): string`
  — returns `YYYY-MM-DD` in `timeZone` (default `Asia/Jakarta`), pure, no DB/browser/global state.
- Consumes: none.

- [ ] **Step 1: Write the failing unit test**

```ts
// src/lib/dates.test.ts
import { describe, expect, it } from 'vitest';
import { businessDateInTimeZone } from './dates';

describe('businessDateInTimeZone', () => {
  it('defaults to Asia/Jakarta (WIB)', () => {
    // 2026-08-04T17:30:00Z == 2026-08-05T00:30:00+07:00
    const result = businessDateInTimeZone('2026-08-04T17:30:00Z');
    expect(result).toBe('2026-08-05');
  });

  it('returns the same date before midnight in UTC', () => {
    // 2026-08-04T23:30:00Z == 2026-08-04T23:30:00+00:00
    const result = businessDateInTimeZone('2026-08-04T23:30:00Z', 'UTC');
    expect(result).toBe('2026-08-04');
  });

  it('crosses midnight into the next business day in WIB', () => {
    // 2026-08-04T16:30:00Z == 2026-08-05T00:30:00+07:00
    const result = businessDateInTimeZone('2026-08-04T16:30:00Z', 'Asia/Jakarta');
    expect(result).toBe('2026-08-05');
  });

  it('accepts a Date instance', () => {
    const result = businessDateInTimeZone(new Date('2026-08-04T17:30:00Z'));
    expect(result).toBe('2026-08-05');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/dates.test.ts --run`
Expected: FAIL — `businessDateInTimeZone` is not exported / cannot resolve module.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/lib/dates.ts
const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Jakarta';

export function businessDateInTimeZone(
  now: Date | number | string,
  timeZone: string = DEFAULT_BUSINESS_TIME_ZONE
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(now));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/dates.test.ts --run`
Expected: PASS (4 tests).

- [ ] **Step 5: Apply the helper to the attendance default date**

Modify `src/lib/db/attendance.ts:88`:

```ts
const today = date ?? businessDateInTimeZone(new Date());
```

Add the import at the top of `src/lib/db/attendance.ts`:

```ts
import { businessDateInTimeZone } from '@/lib/dates';
```

Do not change the explicit-date branch.

- [ ] **Step 6: Add an integration test for the default date path**

In `src/lib/db/attendance.test.ts`, inside `describe('employee attendance')`, add:

```ts
it('uses the business timezone default for "today"', async () => {
  // The record exists only in the WIB business day that the current instant
  // resolves to; the UTC date could be the previous day near midnight.
  const today = businessDateInTimeZone(new Date());
  await db.insert(employeeShifts).values({
    user_id: TEST_USER_ID,
    date: today,
    check_in_time: '09:00',
    attendance_status: 'present'
  });
  const res = await getEmployeeAttendance(TEST_USER_ID);
  expect(res.success).toBe(true);
  expect(res.attendance?.attendance.date).toBe(today);
});
```

Add `businessDateInTimeZone` to the import list of `src/lib/db/attendance.test.ts` from `'@/lib/dates'`.

- [ ] **Step 7: Run the attendance test file**

Run: `bun run test src/lib/db/attendance.test.ts --run`
Expected: PASS (all existing + new tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts src/lib/db/attendance.ts src/lib/db/attendance.test.ts
git commit -m "fix: resolve attendance default date in business timezone"
```

---

## Task 2: XLSX export adapter with official SheetJS distribution

**Files:**
- Create: `src/features/attendance/api/export-adapter.ts`
- Create: `src/features/attendance/api/export-adapter.test.ts`
- Modify: `src/features/attendance/api/service.ts:543-556`
- Modify: `package.json` (dependency)
- Modify: `bun.lock` (via `bun install`)

**Interfaces:**
- Consumes: nothing.
- Produces: `writeXlsxBuffer(rows: Record<string, unknown>[], sheetName?: string): Buffer`
  — builds a SheetJS workbook from `rows` and returns a Buffer via `XLSX.write(..., { type: 'buffer', bookType: 'xlsx' })`.
- Service keeps returning `{ success, format, content, mime, ext }` unchanged.

- [ ] **Step 1: Write the failing adapter test**

```ts
// src/features/attendance/api/export-adapter.test.ts
import { describe, expect, it } from 'vitest';
import { writeXlsxBuffer } from './export-adapter';

describe('writeXlsxBuffer', () => {
  it('produces a non-empty xlsx buffer', () => {
    const buf = writeXlsxBuffer(
      [{ date: '2026-08-04', employee: 'A', status: 'present' }],
      'Attendance'
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK'); // ZIP magic
  });

  it('returns an empty buffer for empty rows without crashing', () => {
    const buf = writeXlsxBuffer([]);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/features/attendance/api/export-adapter.test.ts --run`
Expected: FAIL — module `./export-adapter` not found.

- [ ] **Step 3: Add the official SheetJS distribution**

Remove the old npm package and add the official distribution as documented by SheetJS (mirror tarball pinned to a fixed version):

```bash
bun remove xlsx
bun add xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

If the CDN is unreachable in this environment, use the official mirror documented by SheetJS (e.g. `https://sheet.lol/balls/xlsx-0.20.3.tgz`). Do not fall back to a community fork.

- [ ] **Step 4: Write the adapter implementation**

```ts
// src/features/attendance/api/export-adapter.ts
import { utils, write } from 'xlsx';

export function writeXlsxBuffer(
  rows: Record<string, unknown>[],
  sheetName = 'Attendance'
): Buffer {
  const sheet = utils.json_to_sheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, sheetName);
  return write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
```

- [ ] **Step 5: Run adapter test to verify it passes**

Run: `bun run test src/features/attendance/api/export-adapter.test.ts --run`
Expected: PASS (2 tests).

- [ ] **Step 6: Update the service to use the adapter**

Replace the `format === 'xlsx'` branch in `src/features/attendance/api/service.ts:543-556` with:

```ts
if (format === 'xlsx') {
  const { writeXlsxBuffer } = await import('./export-adapter');
  const buffer = writeXlsxBuffer(rows);
  return {
    success: true,
    format,
    content: buffer.toString('base64'),
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx'
  };
}
```

The `rows` shape stays exactly as currently built in the handler; do not change the response contract.

- [ ] **Step 7: Run typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS (no new errors; no existing failures introduced).

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock src/features/attendance/api/export-adapter.ts src/features/attendance/api/export-adapter.test.ts src/features/attendance/api/service.ts
git commit -m "fix: use official SheetJS distribution via export adapter"
```

---

## Task 3: Clear checkout selfie on successful checkout

**Files:**
- Modify: `src/features/attendance/components/attendance-check-card.tsx` (checkOutMutation `onSuccess`)
- Create: `src/features/attendance/components/attendance-check-card.test.tsx`

**Interfaces:**
- Consumes: existing `checkOutFn` mutation; no signature changes.
- Produces: no new public API. Behavior change: `checkOutSelfie` state is cleared only on success.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/features/attendance/components/attendance-check-card.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttendanceCheckCard from './attendance-check-card';

const clearSpy = vi.fn();

vi.mock('./selfie-capture', () => ({
  SelfieCapture: ({
    onCapture,
    onClear
  }: {
    onCapture: (d: string) => void;
    onClear: () => void;
  }) => (
    <button onClick={() => { onClear(); onCapture('data:image/jpeg;base64,selfie'); }}>
      capture
    </button>
  )
}));

vi.mock('./service', () => ({
  checkOutFn: { useMutation: () => ({ isPending: false, mutate: () => {} }) },
  checkInFn: { useMutation: () => ({ isPending: false, mutate: () => {} }) },
  getMyAttendanceFn: vi.fn()
}));

const renderCard = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  });
  return render(
    <QueryClientProvider client={client}>
      <AttendanceCheckCard />
    </QueryClientProvider>
  );
};

describe('AttendanceCheckCard checkout selfie', () => {
  it('clears the checkout selfie after a successful checkout', async () => {
    clearSpy.mockClear();
    renderCard();
    // The card renders both selfie captures; the checkout flow clears the
    // checkout selfie on success. Assert the clear callback is invoked when
    // the mutation resolves successfully.
    await waitFor(() => expect(clearSpy).not.toHaveBeenCalledTimes(0));
  });
});
```

Notes:
- This test verifies the reset wiring: the checkout mutation's success path must invoke the same `onClear`/`setCheckOutSelfie(null)` that the `SelfieCapture` component's `onClear` prop calls.
- If mocking `useMutation` through `./service` proves brittle (TanStack Server Fn mock shape), the resilient alternative is to extract the success handler into a tiny pure function `clearSelfieAfterSuccess(res, setCheckOutSelfie, invalidate)` in the card file, unit-test that pure function directly, and have the mutation call it. Prefer the pure-function extraction if the component mock is flaky in the runner.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/features/attendance/components/attendance-check-card.test.tsx --run`
Expected: FAIL or error — the checkout mutation's success path currently never clears the checkout selfie, so `clearSpy` assertions cannot pass with the current code.

- [ ] **Step 3: Implement the reset**

In `src/features/attendance/components/attendance-check-card.tsx`, change the `checkOutMutation.onSuccess` to:

```tsx
onSuccess: (res) => {
  if (res?.success) {
    setCheckOutSelfie(null);
    invalidateAttendance();
  } else {
    toast.error(errorMessage(res));
  }
}
```

The check-in mutation remains unchanged; do not clear `checkOutSelfie` on error. If Step 1 chose the pure-function extraction, implement `clearSelfieAfterSuccess` and call it from `onSuccess` instead.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/features/attendance/components/attendance-check-card.test.tsx --run`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run: `bun run test:run`
Expected: PASS (all existing + new tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/attendance/components/attendance-check-card.tsx src/features/attendance/components/attendance-check-card.test.tsx
git commit -m "fix: clear checkout selfie after successful checkout"
```

---

## Task 4: Checkout selfie and selfie_required e2e coverage

**Files:**
- Modify: `e2e/attendance-employee.spec.ts`
- Modify (if needed): `scripts/seed.ts` or `e2e/auth.setup.ts` for a location with `selfie_required: true`

**Interfaces:**
- Consumes: existing employee storage state (`e2e/.auth/employee.json`), seeded locations (`Head Office` at -6.2088, 106.8456, radius 50).
- Produces: two new Playwright tests that exercise checkout selfie success and `selfie_required` failure path.

- [ ] **Step 1: Confirm seed state supports the scenario**

Run: `bun run db:seed`
Check `scripts/seed.ts` `locationData`: `selfie_required` is not set (defaults to `false`). For the failure path we need a location with `selfie_required: true` OR we override the checked-in record via the admin UI. Prefer the simplest deterministic path: update the seed to set `selfie_required: true` on `Head Office` (affects both check-in and check-out in e2e).

- [ ] **Step 2: Update seed for selfie-required location**

In `scripts/seed.ts` `locationData`, add `selfie_required: true` to the `Head Office` entry (and leave `Branch Office 1` as `false`). This gives e2e a deterministic policy to exercise.

- [ ] **Step 3: Write the e2e tests**

Append to `e2e/attendance-employee.spec.ts`:

```ts
test('check-out requires a selfie when the location policy requires one', async ({ page }) => {
  await page.goto('/dashboard/attendance');
  await page.waitForLoadState('networkidle');
  // Check in first (Head Office has selfie_required true; the employee card
  // requires a selfie for check-in).
  await page.getByRole('button', { name: /Get Location/i }).click();
  await page.getByRole('button', { name: /Capture Selfie/i }).click();
  await page.getByRole('button', { name: /Capture Now/i }).click();
  await page.getByRole('button', { name: /Check In/i }).click();
  await expect(page.getByRole('button', { name: /Check Out/i })).toBeVisible({ timeout: 15_000 });

  // Check-out without a selfie must be rejected.
  await page.getByRole('button', { name: /Check Out/i }).click();
  await expect(page.getByText(/selfie is required|selfie wajib/i)).toBeVisible({ timeout: 10_000 });
});

test('check-out with a selfie succeeds and clears the captured preview', async ({ page }) => {
  await page.goto('/dashboard/attendance');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Get Location/i }).click();
  await page.getByRole('button', { name: /Capture Selfie/i }).click();
  await page.getByRole('button', { name: /Capture Now/i }).click();
  await page.getByRole('button', { name: /Check In/i }).click();
  await expect(page.getByRole('button', { name: /Check Out/i })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Capture Selfie/i }).click();
  await page.getByRole('button', { name: /Capture Now/i }).click();
  await page.getByRole('button', { name: /Check Out/i }).click();
  // After success the card returns to the check-in state and the preview is gone.
  await expect(page.getByRole('button', { name: /Check In/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Check Out/i })).toHaveCount(0);
});
```

Note: The exact button labels must match the i18n strings in `attendanceAdmin.captureSelfie`, `attendanceAdmin.captureNow`, `attendance.checkIn`, and `attendance.checkOut`. Verify with `grep -rn "captureSelfie\|captureNow\|checkIn\|checkOut" src/features/attendance/locales` before finalizing selectors.

- [ ] **Step 4: Run the e2e suite (attendance files)**

Run: `bun run e2e -- e2e/attendance-employee.spec.ts`
Expected: PASS (existing 3 tests + new 2 tests).

- [ ] **Step 5: Run full e2e suite**

Run: `bun run e2e`
Expected: PASS (all specs; product CRUD re-enabled in Task 5).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.ts e2e/attendance-employee.spec.ts
git commit -m "test: e2e coverage for checkout selfie and selfie_required policy"
```

---

## Task 5: Re-enable product CRUD e2e coverage

**Files:**
- Modify: `e2e/product-crud.spec.ts`
- Modify (if needed): `e2e/helpers.ts`

**Interfaces:**
- Consumes: `createProduct(page, input)` and `searchProducts(page, term)` helpers from `e2e/helpers.ts`.
- Produces: three active Playwright tests (create/update/delete) that match the current product form (no upload field).

- [ ] **Step 1: Inspect current product form fields**

Confirm the current product form has `#name`, `#price`, `#description`, and the category Radix select. If the form has no upload input, the existing `createProduct` helper already skips upload (it does not reference upload). If the form requires additional fields (e.g. `#stock`), extend `createProduct` to fill them.

- [ ] **Step 2: Replace `test.skip` with active tests**

In `e2e/product-crud.spec.ts`, remove `test.skip(` from all three tests. Keep the bodies as-is if the form matches; otherwise update selectors per Step 1. Remove the outdated "Pre-existing breakage" comment block, replacing it with a note that the upload flow was removed and the CRUD flow no longer references it.

- [ ] **Step 3: Run the product e2e tests**

Run: `bun run e2e -- e2e/product-crud.spec.ts`
Expected: PASS (3 tests). If any test fails on a form field mismatch, fix the helper/selector and re-run.

- [ ] **Step 4: Run the full e2e suite**

Run: `bun run e2e`
Expected: PASS (all specs).

- [ ] **Step 5: Commit**

```bash
git add e2e/product-crud.spec.ts e2e/helpers.ts
git commit -m "test: re-enable product CRUD e2e without upload flow"
```

---

## Task 6: HR permission documentation and process notes

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/TODO.md`
- Modify: `docs/API.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ATTENDANCE.md`
- Modify: `docs/PRD.md`
- Modify: `README.md` (migration DB sync workflow note, only if not conflicting)

**Interfaces:**
- Consumes: the decisions from the spec.
- Produces: documentation reflecting HR `attendance.edit` decision, deferred schedule policy overrides, MapLibre workaround, xlsx dependency note, and manual migration sync.

- [ ] **Step 1: Document the HR decision**

In `docs/API.md` under the admin endpoints section and `docs/ARCHITECTURE.md` under permissions, add:

```md
- HR retains `attendance.edit` by intentional product decision (attendance expansion, 2026-08-04).
```

Do not change any permission checks or role-group seed.

- [ ] **Step 2: Record residual/deferred items**

In `docs/TODO.md`, replace the `xlsx` item with:

```md
- [x] Replace `xlsx` npm package with the official SheetJS distribution via export adapter
```

Add (if not present):

```md
- [ ] Schedule-level policy overrides — deferred by design (out of MVP)
- [ ] Migrate custom MapLibre wrapper to mapcn when registry is available
- [ ] Keep dev + test DB migrations in sync via db:push/db:migrate (manual workflow)
```

- [ ] **Step 3: Update CHANGELOG**

In `docs/CHANGELOG.md`, add a line under the current release:

```md
- **Residual hardening** — checkout selfie state reset, business timezone date defaults (WIB default), official SheetJS distribution for XLSX export, HR `attendance.edit` documented as intentional.
```

- [ ] **Step 4: Update ATTENDANCE and PRD docs**

In `docs/ATTENDANCE.md`, add a short note about business-date resolution in WIB and the checkout selfie reset. In `docs/PRD.md`, mark the HR `attendance.edit` decision as accepted (checkbox already present if it was marked; verify wording matches the decision).

- [ ] **Step 5: Add migration sync note to README**

In `README.md` Quick Start section, after the `db:migrate:run` line, add:

```md
> Schema changes: keep dev and test databases in sync — run `db:push` (dev) and `db:migrate:run` (test) together, and commit migrations via `db:generate`.
```

Only add this if it does not conflict with the existing user edits to `README.md`; if the section already has a sync note, skip.

- [ ] **Step 6: Commit docs (force-add)**

```bash
git add -f docs/CHANGELOG.md docs/TODO.md docs/API.md docs/ARCHITECTURE.md docs/ATTENDANCE.md docs/PRD.md README.md
git commit -m "docs: record HR attendance.edit decision and residual hardening notes"
```

---

## Task 7: Final verification and diff review

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: all completed tasks.

- [ ] **Step 1: Run the full verification suite**

```bash
bun run lint
bun run typecheck
bun run test:run
bun run build
```

Expected: all pass. If `bun run build` fails due to the XLSX distribution import in the server bundle, verify the official package exposes `utils`/`write` under `xlsx` and adjust the adapter import (`import * as XLSX from 'xlsx'` if named exports are unavailable). Fix and re-run.

- [ ] **Step 2: Dependency audit**

Run: `bun pm audit --production` (or the project's audit command). Confirm no new high-severity findings from the XLSX replacement.

- [ ] **Step 3: Review diff and status**

```bash
git status --short
git diff --stat
```

Review the staged/unstaged changes. Ensure only intended files changed; do NOT commit unrelated worktree documentation edits that were present before this plan (they are out of scope).

- [ ] **Step 4: Run e2e one final time**

Run: `bun run e2e`
Expected: PASS.

- [ ] **Step 5: No push**

Do NOT run `git push`. Local commits remain local for user review.

- [ ] **Step 6: Report summary**

Report: list of commits created, verification results, remaining deferred items (schedule policy override, MapLibre/mapcn), and the exact push-ready state (20+ commits ahead of `origin/main` now including these tasks).

---
