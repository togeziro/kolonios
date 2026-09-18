// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('invokes prev/next/today callbacks when the buttons are clicked', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: /previous week/i }));
    await user.click(screen.getByRole('button', { name: /today/i }));
    await user.click(screen.getByRole('button', { name: /next week/i }));
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
    expect(screen.getByText('← Prev week')).toBeInTheDocument();
    expect(screen.getByText('Next week →')).toBeInTheDocument();
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
    expect(screen.getByText(/Aug 3 . 9, 2026/)).toBeInTheDocument();
  });

  it('snaps the month picker to the 15th of the chosen month, keeping the year', async () => {
    const user = userEvent.setup();
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
    await user.selectOptions(select, '09');
    expect(onPickDate).toHaveBeenCalledWith('2026-09-15');
  });

  it('snaps the year picker to the 15th of the same month, keeping the month', async () => {
    const user = userEvent.setup();
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
    await user.selectOptions(select, '2027');
    expect(onPickDate).toHaveBeenCalledWith('2027-08-15');
  });
});
