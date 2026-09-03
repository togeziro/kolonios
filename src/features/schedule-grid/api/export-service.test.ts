/**
 * Integration tests for `export-service.ts` (schedule-grid ticket-02 month
 * export). Drives the production server-fn handler via the `?tss-serverfn-split`
 * provider against the actual test DB, then parses the returned xlsx with
 * SheetJS to assert the workbook shape (header cols = daysInMonth, OFF/HOLIDAY
 * mapping) and the `attendance_admin:view` guard (403 for a denied caller).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  resetAllTables,
  seedDepartment,
  seedEmployee,
  seedShift,
  seedShiftWeekdayRule
} from '@/test-utils/db';
import { db } from '@/lib/db';
import { nationalHolidays } from '@/lib/db/schema/attendance';

const sessionUser = vi.hoisted(() => ({
  id: 'schedule-grid-export-admin',
  role: 'admin',
  permissions: { attendance_admin: { view: true } }
}));
const getSessionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const requirePermissionMock = vi.hoisted(() => vi.fn(async () => ({ user: sessionUser })));
const checkRateLimitMock = vi.hoisted(() => vi.fn(async () => undefined));

const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

const createServerFnMock = vi.hoisted(() => {
  return () => {
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
  };
});

vi.mock('@tanstack/react-start', () => ({
  createServerFn: createServerFnMock
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
import { exportMonthFn_createServerFn_handler } from './export-service?tss-serverfn-split';

const MONTH = '2026-09';
const EMPLOYEE_USER_ID = 'schedule-grid-export-employee';

function readWorkbook(base64: string) {
  const buffer = Buffer.from(base64, 'base64');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1
  }) as unknown as string[][];
  return { wb, sheet, rows };
}

async function seedShiftSchedule(shiftName = 'KPI') {
  // Employee in a dedicated department so the division filter is deterministic.
  const { employee, department } = await seedEmployee(EMPLOYEE_USER_ID);
  const shift = await seedShift({ name: shiftName });
  // Working Mon–Fri (day_of_week 1..5); weekend days stay rule-less so a
  // Saturday holiday resolves to HOLIDAY (no shift) instead of KPI.
  for (let dow = 1; dow <= 5; dow += 1) {
    await seedShiftWeekdayRule(shift.id, { day_of_week: dow });
  }
  const { scheduleAssignments } = await import('@/lib/db/schema/attendance');
  await db.insert(scheduleAssignments).values({
    user_id: EMPLOYEE_USER_ID,
    shift_id: shift.id,
    effective_from: '2026-08-01',
    effective_to: null,
    created_by: sessionUser.id
  });
  return { employee, department, shift };
}

beforeEach(async () => {
  await resetAllTables();
  serverFnProvider.handler = exportMonthFn_createServerFn_handler;
  requirePermissionMock.mockReset();
  requirePermissionMock.mockResolvedValue({ user: sessionUser });
  checkRateLimitMock.mockReset();
});

afterAll(async () => {
  await resetAllTables();
});

describe('exportMonthFn (integration)', () => {
  it('exports a workbook whose header columns equal the days in the month', async () => {
    await seedShiftSchedule();

    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, divisionId: null, query: null }
    })) as { success: boolean; base64: string; filename: string; mime: string };

    expect(res.success).toBe(true);
    expect(res.filename).toBe('Shift_Schedule_2026-09.xlsx');
    expect(res.mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const { rows } = readWorkbook(res.base64);
    // Name | Employee Code | Division + 30 September days.
    expect(rows[0].length).toBe(33);
    expect(rows[0][3]).toBe('2026-09-01');
    expect(rows[0][32]).toBe('2026-09-30');
  });

  it('maps resolved shifts (KPI), day offs (OFF), holidays (HOLIDAY) and unassigned (—)', async () => {
    await seedShiftSchedule('KPI');
    // 2026-09-03 (Thu) is a working day → make it a day off.
    const { dayOffs } = await import('@/lib/db/schema/attendance');
    await db.insert(dayOffs).values({
      user_id: EMPLOYEE_USER_ID,
      date: '2026-09-03',
      reason: 'Cuti',
      created_by: sessionUser.id
    });
    // 2026-09-05 (Sat) is a non-working day → national holiday (no shift).
    await db.insert(nationalHolidays).values({
      date: '2026-09-05',
      name: 'Test Holiday',
      is_recurring: false
    });

    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, divisionId: null, query: null }
    })) as { success: boolean; base64: string };

    const { rows } = readWorkbook(res.base64);
    const dataRow = rows[1];
    // Column index = 3 (prelude) + (dayOfMonth - 1).
    const valueFor = (dayOfMonth: number) => dataRow[3 + (dayOfMonth - 1)];
    expect(valueFor(1)).toBe('KPI'); // Tue, working day
    expect(valueFor(3)).toBe('OFF'); // Thu, day off
    expect(valueFor(4)).toBe('KPI'); // Fri, working day
    expect(valueFor(5)).toBe('HOLIDAY'); // Sat, national holiday, no rule
    expect(valueFor(6)).toBe('—'); // Sun, no rule, no holiday
  });

  it('filters by division (department)', async () => {
    const { department } = await seedShiftSchedule();
    const otherDept = await seedDepartment({ code: 'OTHER-DEPT' });

    const res = (await serverFnProvider.handler!({
      data: { month: MONTH, divisionId: String(otherDept.id), query: null }
    })) as { success: boolean; base64: string };

    const { rows } = readWorkbook(res.base64);
    // Only the header row — the employee lives in `department`, not `otherDept`.
    expect(rows).toHaveLength(1);
    expect(rows[0].length).toBe(33);
    expect(department).toBeDefined();
  });

  it('denies technicians (403) via the attendance_admin:view guard', async () => {
    requirePermissionMock.mockRejectedValue(new Error('Forbidden: attendance_admin.view required'));

    await expect(
      serverFnProvider.handler!({
        data: { month: MONTH, divisionId: null, query: null }
      })
    ).rejects.toThrow(/Forbidden/);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });
});
