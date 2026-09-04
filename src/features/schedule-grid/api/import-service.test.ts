/**
 * Integration tests for `import-service.ts` (schedule-grid ticket-04 month
 * import). Drives the production server-fn handler via the
 * `?tss-serverfn-split` provider against the actual test DB, then asserts
 * roundtrip behaviour: KPI → date_overrides, OFF → day_offs, — → clear,
 * unknown codes → partialFailures, holiday skip, case-insensitive lookups.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  resetAllTables,
  seedEmployee,
  seedShift,
  seedShiftWeekdayRule,
  seedDepartment
} from '@/test-utils/db';
import { db } from '@/lib/db';
import { dateOverrides, dayOffs } from '@/lib/db/schema/attendance';

const sessionUser = vi.hoisted(() => ({
  id: 'schedule-grid-import-admin',
  role: 'admin',
  permissions: { attendance_admin: { edit: true } }
}));
const getSessionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const requirePermissionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const checkRateLimitMock = vi.hoisted(() => vi.fn(async () => undefined));

const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator: { parse(input: unknown): unknown } | undefined;
    const builder = {
      validator(nextValidator: { parse(input: unknown): unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(...handlers: Array<(context: { data: unknown }) => unknown>) {
        const nextHandler = handlers.at(-1)!;
        const invoke = async (options: { data: unknown }) =>
          nextHandler({
            data: validator ? validator.parse(options.data) : options.data
          });
        return Object.assign(invoke, { __executeServer: invoke });
      }
    };
    return builder;
  }
}));

vi.mock('@tanstack/react-start/server-rpc', () => ({
  createServerRpc: (_meta: unknown, fn: (options: unknown) => unknown) => fn
}));

vi.mock('@tanstack/react-start/ssr-rpc', () => ({
  createSsrRpc: () => (options: { data: unknown }) => serverFnProvider.handler!(options)
}));

vi.mock('@/lib/auth/auth.server', () => ({
  auth: { api: { getSession: getSessionMock } }
}));

vi.mock('@/lib/auth/session', () => ({
  requirePermission: requirePermissionMock
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock
}));

// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { importMonthFn_createServerFn_handler } from './import-service?tss-serverfn-split';

const MONTH = '2026-09';

function buildWorkbookBase64(
  headerDates: string[],
  rows: Array<[string, string, string, ...string[]]>
): string {
  const header = ['Name', 'Employee Code', 'Division', ...headerDates];
  const aoa: string[][] = [header];
  for (const row of rows) aoa.push(row as unknown as string[]);
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Shift Schedule');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer.toString('base64');
}

async function seedTwoEmployeesWithShift() {
  const shift = await seedShift({ name: 'KPI' });
  for (let dow = 1; dow <= 5; dow += 1) {
    await seedShiftWeekdayRule(shift.id, { day_of_week: dow });
  }
  // Deterministic employee codes so the workbook mapping is predictable.
  const dept = await seedDepartment({ code: 'IMP-DEPT' });
  // Seed two employees manually to control employee_code values.
  const { employee: empA } = await seedEmployee('schedule-grid-import-emp-a', {
    employee_code: 'EMP-A',
    full_name: 'Aldi Pranata',
    department_id: dept.id
  });
  const { employee: empB } = await seedEmployee('schedule-grid-import-emp-b', {
    employee_code: 'EMP-B',
    full_name: 'Bayu Saputra',
    department_id: dept.id
  });
  return { shift, empA, empB };
}

beforeEach(async () => {
  await resetAllTables();
  serverFnProvider.handler = importMonthFn_createServerFn_handler;
  requirePermissionMock.mockReset();
  requirePermissionMock.mockResolvedValue({ user: sessionUser });
  checkRateLimitMock.mockReset();
  checkRateLimitMock.mockResolvedValue(undefined);
});

afterAll(async () => {
  await resetAllTables();
});

describe('importMonthFn (integration)', () => {
  it('happy import 2 users × 3 dates: KPI → override, OFF → dayOff, — → clear', async () => {
    const { shift, empA, empB } = await seedTwoEmployeesWithShift();

    // Pre-seed a cell that the import will clear via "—".
    await db.insert(dateOverrides).values({
      user_id: empA.id,
      date: '2026-09-03',
      shift_id: shift.id,
      created_by: sessionUser.id
    });

    const base64 = buildWorkbookBase64(
      ['2026-09-01', '2026-09-02', '2026-09-03'],
      [
        ['Aldi Pranata', 'EMP-A', 'Operations', 'KPI', 'OFF', '—'],
        ['Bayu Saputra', 'EMP-B', 'Engineering', 'kpi', 'libur', '-']
      ]
    );

    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, fileBase64: base64 }
    })) as {
      success: boolean;
      rowsApplied: number;
      cellsApplied: number;
      partialFailures: unknown[];
    };

    expect(res.success).toBe(true);
    expect(res.cellsApplied).toBe(6);
    expect(res.rowsApplied).toBe(2);
    expect(res.partialFailures).toHaveLength(0);

    // KPI → date_overrides
    const overrides = await db.select().from(dateOverrides);
    expect(overrides.some((r) => r.user_id === empA.id && r.date === '2026-09-01')).toBe(true);
    expect(overrides.some((r) => r.user_id === empB.id && r.date === '2026-09-01')).toBe(true);
    // OFF / LIBUR → day_offs
    const offs = await db.select().from(dayOffs);
    expect(offs.some((r) => r.user_id === empA.id && r.date === '2026-09-02')).toBe(true);
    expect(offs.some((r) => r.user_id === empB.id && r.date === '2026-09-02')).toBe(true);
    // — / - → clear (no override nor day off remains for 2026-09-03)
    const overridesSep3 = overrides.filter((r) => r.date === '2026-09-03');
    const offsSep3 = offs.filter((r) => r.date === '2026-09-03');
    expect(overridesSep3).toHaveLength(0);
    expect(offsSep3).toHaveLength(0);
  });

  it('unknown shift code → partialFailure, other cells still apply', async () => {
    await seedTwoEmployeesWithShift();

    const base64 = buildWorkbookBase64(
      ['2026-09-01', '2026-09-02', '2026-09-03'],
      [['Aldi Pranata', 'EMP-A', 'Operations', 'KPI', 'UNKNOWN_XYZ', 'OFF']]
    );

    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, fileBase64: base64 }
    })) as {
      success: boolean;
      cellsApplied: number;
      partialFailures: Array<{ error: string; date: string }>;
    };

    expect(res.success).toBe(true);
    expect(res.cellsApplied).toBe(2);
    expect(res.partialFailures).toHaveLength(1);
    expect(res.partialFailures[0].error).toBe('unknownShiftCode');
    expect(res.partialFailures[0].date).toBe('2026-09-02');

    const overrides = await db.select().from(dateOverrides);
    const offs = await db.select().from(dayOffs);
    expect(overrides.some((r) => r.date === '2026-09-01')).toBe(true);
    expect(offs.some((r) => r.date === '2026-09-03')).toBe(true);
    // Unknown cell left untouched.
    expect(overrides.some((r) => r.date === '2026-09-02')).toBe(false);
    expect(offs.some((r) => r.date === '2026-09-02')).toBe(false);
  });

  it('HOLIDAY / — → clear (delete both tables), not inserted', async () => {
    const { shift, empA } = await seedTwoEmployeesWithShift();
    // Seed both a day off and an override for the same date; import HOLIDAY should clear both.
    await db
      .insert(dayOffs)
      .values({ user_id: empA.id, date: '2026-09-05', reason: null, created_by: sessionUser.id });
    await db.insert(dateOverrides).values({
      user_id: empA.id,
      date: '2026-09-06',
      shift_id: shift.id,
      created_by: sessionUser.id
    });

    const base64 = buildWorkbookBase64(
      ['2026-09-05', '2026-09-06'],
      [['Aldi Pranata', 'EMP-A', 'Operations', 'HOLIDAY', '—']]
    );

    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, fileBase64: base64 }
    })) as { success: boolean; cellsApplied: number; partialFailures: unknown[] };

    expect(res.success).toBe(true);
    expect(res.cellsApplied).toBe(2);
    expect(res.partialFailures).toHaveLength(0);

    const offs = await db
      .select()
      .from(dayOffs)
      .then((rows) => rows.filter((r) => r.user_id === empA.id));
    const overrides = await db
      .select()
      .from(dateOverrides)
      .then((rows) => rows.filter((r) => r.user_id === empA.id));
    expect(offs).toHaveLength(0);
    expect(overrides).toHaveLength(0);
  });

  it('DAY OFF / LIBUR variants are recognised case-insensitively', async () => {
    const { empA } = await seedTwoEmployeesWithShift();
    const base64 = buildWorkbookBase64(
      ['2026-09-01', '2026-09-02'],
      [['Aldi Pranata', 'EMP-A', 'Operations', 'day off', 'LIBUR']]
    );

    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, fileBase64: base64 }
    })) as { success: boolean; cellsApplied: number; partialFailures: unknown[] };

    expect(res.success).toBe(true);
    expect(res.cellsApplied).toBe(2);
    expect(res.partialFailures).toHaveLength(0);
    const offs = await db.select().from(dayOffs);
    expect(offs.filter((r) => r.user_id === empA.id)).toHaveLength(2);
  });

  it('only columns whose header is YYYY-MM-DD within the requested month are processed', async () => {
    const { empA } = await seedTwoEmployeesWithShift();
    // 2026-10-01 column should be ignored when month = 2026-09.
    const base64 = buildWorkbookBase64(
      ['2026-09-01', '2026-10-01', 'not-a-date'],
      [['Aldi Pranata', 'EMP-A', 'Operations', 'KPI', 'KPI', 'KPI']]
    );

    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, fileBase64: base64 }
    })) as { success: boolean; cellsApplied: number; partialFailures: unknown[] };

    expect(res.success).toBe(true);
    expect(res.cellsApplied).toBe(1);
    const overrides = await db.select().from(dateOverrides);
    expect(overrides.filter((r) => r.user_id === empA.id && r.date === '2026-09-01')).toHaveLength(
      1
    );
    expect(overrides.filter((r) => r.date === '2026-10-01')).toHaveLength(0);
  });

  it('employee_code lookup is case-insensitive', async () => {
    await seedTwoEmployeesWithShift();
    const base64 = buildWorkbookBase64(
      ['2026-09-01'],
      [['Aldi Pranata', 'emp-a', 'Operations', 'KPI']]
    );
    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, fileBase64: base64 }
    })) as { success: boolean; cellsApplied: number };
    expect(res.cellsApplied).toBe(1);
  });

  it('roundtrip Export→Import: editing one cell to OFF reflects as Is Day Off', async () => {
    const { empA } = await seedTwoEmployeesWithShift();
    // Export would produce KPI for 2026-09-01; import it then overwrite to OFF.
    const firstImport = buildWorkbookBase64(
      ['2026-09-01'],
      [['Aldi Pranata', 'EMP-A', 'Operations', 'KPI']]
    );
    await serverFnProvider.handler!({ data: { month: MONTH, fileBase64: firstImport } });
    let overrides = await db.select().from(dateOverrides);
    expect(overrides.some((r) => r.user_id === empA.id && r.date === '2026-09-01')).toBe(true);

    const secondImport = buildWorkbookBase64(
      ['2026-09-01'],
      [['Aldi Pranata', 'EMP-A', 'Operations', 'OFF']]
    );
    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, fileBase64: secondImport }
    })) as {
      success: boolean;
      cellsApplied: number;
    };
    expect(res.cellsApplied).toBe(1);
    overrides = await db.select().from(dateOverrides);
    const offs = await db.select().from(dayOffs);
    // OFF replaced the override: override deleted, day_off inserted.
    expect(overrides.some((r) => r.user_id === empA.id && r.date === '2026-09-01')).toBe(false);
    expect(offs.some((r) => r.user_id === empA.id && r.date === '2026-09-01')).toBe(true);
  });

  it('denies technicians (403) via attendance_admin:edit guard', async () => {
    requirePermissionMock.mockRejectedValue(new Error('Forbidden: attendance_admin.edit required'));
    const base64 = buildWorkbookBase64(['2026-09-01'], [['Aldi', 'EMP-A', 'Div', 'KPI']]);
    await expect(
      serverFnProvider.handler!({ data: { month: MONTH, fileBase64: base64 } })
    ).rejects.toThrow(/Forbidden/);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });
});
