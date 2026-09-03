// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { createElement } from 'react';
import '@/i18n/config';
import { WeekNav } from './week-nav';

describe('WeekNav', () => {
  const baseProps = {
    weekStart: '2026-08-03',
    weekEnd: '2026-08-09',
    month: '08',
    year: '2026'
  };

  it('invokes prev/next/today callbacks when the buttons are clicked', () => {
    const onPrev = vi.fn();
    const onToday = vi.fn();
    const onNext = vi.fn();
    const onPickDate = vi.fn();

    render(
      createElement(WeekNav, {
        ...baseProps,
        onPrev,
        onToday,
        onNext,
        onPickDate
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /previous week/i }));
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('button', { name: /next week/i }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('renders the Kerjoo-parity ← Prev week / Next week → button labels', () => {
    render(
      createElement(WeekNav, {
        ...baseProps,
        onPrev: vi.fn(),
        onToday: vi.fn(),
        onNext: vi.fn(),
        onPickDate: vi.fn()
      })
    );
    expect(screen.getByText('← Prev week')).toBeTruthy();
    expect(screen.getByText('Next week →')).toBeTruthy();
  });

  it('renders the same-month range label for a week that does not cross a month', () => {
    render(
      createElement(WeekNav, {
        ...baseProps,
        onPrev: vi.fn(),
        onToday: vi.fn(),
        onNext: vi.fn(),
        onPickDate: vi.fn()
      })
    );
    expect(screen.getByText(/Aug 3 . 9, 2026/)).toBeTruthy();
  });

  it('snaps the month picker to the 15th of the chosen month, keeping the year', () => {
    const onPickDate = vi.fn();
    render(
      createElement(WeekNav, {
        ...baseProps,
        onPrev: vi.fn(),
        onToday: vi.fn(),
        onNext: vi.fn(),
        onPickDate
      })
    );
    const select = screen.getByLabelText(/jump to month/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '09' } });
    expect(onPickDate).toHaveBeenCalledWith('2026-09-15');
  });

  it('snaps the year picker to the 15th of the same month, keeping the month', () => {
    const onPickDate = vi.fn();
    render(
      createElement(WeekNav, {
        ...baseProps,
        onPrev: vi.fn(),
        onToday: vi.fn(),
        onNext: vi.fn(),
        onPickDate
      })
    );
    const select = screen.getByLabelText(/jump to year/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '2027' } });
    expect(onPickDate).toHaveBeenCalledWith('2027-08-15');
  });
});
