// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HolidayCalendarView } from './holiday-calendar-view';
import '@/i18n/config';

const h = vi.hoisted(() => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 15);
  return {
    year: now.getFullYear(),
    dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
  };
});

vi.mock('@/features/holiday-calendar/api/queries', () => ({
  useNationalHolidays: () => ({
    data: {
      holidays: [
        {
          id: 1,
          name: 'Test Holiday',
          date: h.dateStr,
          is_recurring: false,
          source: 'manual',
          description: null
        }
      ]
    },
    isLoading: false,
    error: undefined
  })
}));

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(HolidayCalendarView, { year: h.year })
    )
  );
}

describe('HolidayCalendarView', () => {
  it('marks holiday dates with the holiday-date modifier class', async () => {
    const { container } = renderView();

    await waitFor(() => {
      expect(container.querySelectorAll('.holiday-date').length).toBeGreaterThan(0);
    });
  });

  it('keeps the day button positioned so the holiday marker anchors to it', async () => {
    const { container } = renderView();

    await waitFor(() => {
      expect(container.querySelector('.holiday-date')).toBeTruthy();
    });
    const marker = container.querySelector('.holiday-date');
    expect(marker!.getAttribute('class')).toContain('relative');
  });
});
