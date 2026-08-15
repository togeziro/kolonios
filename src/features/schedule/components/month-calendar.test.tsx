// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { MonthCalendar } from './month-calendar';
import type { MonthGridCell } from '../utils/build-month-grid';

function cell(date: string, patch: Partial<MonthGridCell> = {}): MonthGridCell {
  return {
    date,
    dayOfWeek: new Date(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10))
    ).getDay(),
    isWorkingDay: true,
    startTime: '08:00',
    endTime: '17:00',
    lateToleranceMinutes: 10,
    isDayOff: false,
    isHoliday: false,
    holidayName: null,
    ...patch
  };
}

// 31 cells for August 2026; holiday on the 17th, day off on the 21st
const cells: MonthGridCell[] = Array.from({ length: 31 }, (_, i) => {
  const date = `2026-08-${String(i + 1).padStart(2, '0')}`;
  if (date === '2026-08-17') {
    return cell(date, { isHoliday: true, holidayName: 'Independence Day', isWorkingDay: false });
  }
  if (date === '2026-08-21') {
    return cell(date, { isDayOff: true, isWorkingDay: false });
  }
  return cell(date);
});

describe('MonthCalendar', () => {
  it('renders the month title and all day numbers', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MonthCalendar month='2026-08' cells={cells} />
      </I18nextProvider>
    );
    expect(screen.getByText('17')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('shows holiday name legend for the holiday cell', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MonthCalendar month='2026-08' cells={cells} />
      </I18nextProvider>
    );
    expect(screen.getByLabelText(/Independence Day/)).toBeTruthy();
  });
});
