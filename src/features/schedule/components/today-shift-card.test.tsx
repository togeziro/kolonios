// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { TodayShiftCard } from './today-shift-card';
import type { MonthGridCell } from '../utils/build-month-grid';

function cell(date: string, patch: Partial<MonthGridCell> = {}): MonthGridCell {
  return {
    date,
    dayOfWeek: 0,
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

describe('TodayShiftCard', () => {
  it('renders the holiday name for a holiday cell', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TodayShiftCard
          today={cell('2026-08-17', {
            isHoliday: true,
            holidayName: 'Independence Day',
            isWorkingDay: false
          })}
          todayDate='2026-08-17'
        />
      </I18nextProvider>
    );
    expect(screen.getByText('Independence Day')).toBeTruthy();
  });

  it('renders the day-off label for a day-off cell', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TodayShiftCard
          today={cell('2026-08-21', { isDayOff: true, isWorkingDay: false })}
          todayDate='2026-08-21'
        />
      </I18nextProvider>
    );
    expect(screen.getByText(i18n.t('schedule.dayOff'))).toBeTruthy();
  });

  it('renders the no-schedule label for a non-working cell', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TodayShiftCard
          today={cell('2026-08-22', { isWorkingDay: false })}
          todayDate='2026-08-22'
        />
      </I18nextProvider>
    );
    expect(screen.getByText(i18n.t('schedule.noSchedule'))).toBeTruthy();
  });

  it('renders the shift hours and late tolerance for a working cell', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TodayShiftCard today={cell('2026-08-10')} todayDate='2026-08-10' />
      </I18nextProvider>
    );
    expect(screen.getByText(/08:00/)).toBeTruthy();
    expect(screen.getByText(/17:00/)).toBeTruthy();
    expect(
      screen.getByText(new RegExp(i18n.t('schedule.lateTolerance', { minutes: 10 })))
    ).toBeTruthy();
  });
});
