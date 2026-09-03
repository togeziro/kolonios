// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n/config';
import { businessDateInTimeZone } from '@/lib/dates';
import { ScheduleGrid } from './schedule-grid';
import type { ScheduleGridResponse } from '../api/types';

vi.mock('@/lib/dates', () => ({
  businessDateInTimeZone: vi.fn(() => '2026-09-03')
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

function makeResponse(overrides: Partial<ScheduleGridResponse> = {}): ScheduleGridResponse {
  return {
    month: '2026-08',
    weekStart: '2026-08-03',
    weekEnd: '2026-08-09',
    rows: [],
    total: 0,
    page: 1,
    pageSize: 25,
    holidays: { byDate: {} },
    ...overrides
  };
}

function withQueryClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, node);
}

describe('ScheduleGrid', () => {
  it('renders the employee column header and seven day columns', () => {
    render(withQueryClient(createElement(ScheduleGrid, { response: makeResponse() })));
    expect(screen.getByText(/employee/i)).toBeTruthy();
    // Seven day numbers — for 2026-08-03..2026-08-09 we expect 03..09.
    for (const day of ['03', '04', '05', '06', '07', '08', '09']) {
      expect(screen.getAllByText(day).length).toBeGreaterThan(0);
    }
  });

  it('renders an employee row with the resolved shift for a working day', () => {
    const response = makeResponse({
      rows: [
        {
          userId: 'u1',
          fullName: 'Aldi Pranata',
          employeeCode: 'EMP-0001',
          divisionId: 2,
          divisionName: 'Engineering',
          activeShiftName: 'Morning',
          hasAssignment: true,
          cells: [
            {
              date: '2026-08-03',
              shiftId: 1,
              shiftName: 'Morning',
              startTime: '08:00',
              endTime: '17:00',
              lateToleranceMinutes: 5,
              absenceCutoffMinutes: 120,
              isDayOff: false,
              hasAssignment: true,
              isHoliday: false,
              holidayName: null,
              holidayOverUnassigned: false,
              dayOffReason: null,
              policyMissing: false
            },
            {
              date: '2026-08-04',
              shiftId: null,
              shiftName: null,
              startTime: null,
              endTime: null,
              lateToleranceMinutes: null,
              absenceCutoffMinutes: null,
              isDayOff: true,
              hasAssignment: true,
              isHoliday: false,
              holidayName: null,
              holidayOverUnassigned: false,
              dayOffReason: 'Family event',
              policyMissing: false
            },
            ...Array.from({ length: 5 }, () => ({
              date: '2026-08-05',
              shiftId: null,
              shiftName: null,
              startTime: null,
              endTime: null,
              lateToleranceMinutes: null,
              absenceCutoffMinutes: null,
              isDayOff: false,
              hasAssignment: false,
              isHoliday: false,
              holidayName: null,
              holidayOverUnassigned: false,
              dayOffReason: null,
              policyMissing: false
            }))
          ]
        }
      ]
    });

    render(withQueryClient(createElement(ScheduleGrid, { response })));

    expect(screen.getByText('Aldi Pranata')).toBeTruthy();
    expect(screen.getByText(/EMP-0001 · Engineering/)).toBeTruthy();
    expect(screen.getAllByText('Morning').length).toBeGreaterThan(0);
    // Day Off pill on 2026-08-04
    expect(screen.getAllByText(/day off/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Family event')).toBeTruthy();
  });

  it('renders a flag emoji and the holiday name on a holiday column header', () => {
    const response = makeResponse({
      holidays: { byDate: { '2026-08-03': 'Independence Day' } }
    });

    render(withQueryClient(createElement(ScheduleGrid, { response })));
    // The 🇮🇩 character is the convention copied from MySchedulePage.
    expect(screen.getByText('🇮🇩')).toBeTruthy();
    expect(screen.getByText('Independence Day')).toBeTruthy();
  });

  it('highlights the today column header (5th column = Thursday 03 Sep 2026) with table-success and aria-current=date', () => {
    // Week Mon 2026-08-31..Sun 2026-09-06 contains Thursday 2026-09-03,
    // which is the 5th columnheader once the employee column is counted.
    const response = makeResponse({ weekStart: '2026-08-31', weekEnd: '2026-09-06' });

    render(
      withQueryClient(
        createElement(ScheduleGrid, {
          response,
          today: businessDateInTimeZone(new Date())
        })
      )
    );

    const headers = screen.getAllByRole('columnheader');
    const todayHeader = headers[4];
    expect(todayHeader.className).toContain('table-success');
    expect(todayHeader.className).toContain('bg-success');
    expect(todayHeader.getAttribute('aria-current')).toBe('date');
    expect(headers[3].getAttribute('aria-current')).toBeNull();
  });
});
