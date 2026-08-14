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
  // Seed the holiday on the 15th — unless today IS the 15th, in which case the
  // day cell also renders the "Today" badge and `.holiday-date button span + span`
  // picks the badge instead of the pill. Falling back to the 16th keeps the
  // holiday off today so the pill selector stays deterministic.
  const day = now.getDate() === 15 ? 16 : 15;
  const d = new Date(now.getFullYear(), now.getMonth(), day);
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

vi.mock('@/features/holiday-calendar/api/mutations', () => ({
  useCreateNationalHoliday: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateNationalHoliday: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useImportHolidaysFromApi: () => ({ mutate: vi.fn(), isPending: false })
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

  it('renders the holiday name as a pill on the grid date', async () => {
    const { container } = renderView();

    await waitFor(() => {
      expect(container.querySelector('.holiday-date button span + span')).toBeTruthy();
    });
    const pill = container.querySelector('.holiday-date button span + span');
    expect(pill!.textContent).toBe('Test Holiday');
  });

  it('announces the holiday name in the day button accessible label', async () => {
    const { container } = renderView();

    await waitFor(() => {
      expect(container.querySelector('.holiday-date button')).toBeTruthy();
    });
    const dayButton = container.querySelector('.holiday-date button');
    expect(dayButton!.getAttribute('aria-label')).toContain('Test Holiday');
  });

  it('marks today with aria-current and a "Today" badge', async () => {
    const { container } = renderView();

    await waitFor(() => {
      expect(container.querySelector('[aria-current="date"]')).toBeTruthy();
    });
    const todayButton = container.querySelector('[aria-current="date"]');
    expect(todayButton!.textContent).toContain('Today');
    const numberSpan = todayButton!.querySelector('span');
    expect(numberSpan!.className).toContain('bg-emerald-500');
  });

  it('auto-selects today on mount so the details panel is ready', async () => {
    const { container } = renderView();

    await waitFor(() => {
      expect(container.querySelector('[aria-current="date"]')).toBeTruthy();
    });
    const selectedCell = container.querySelector('[aria-selected="true"]');
    expect(selectedCell).toBeTruthy();
  });

  it('renders a close button on the selected-date details panel', async () => {
    const { container } = renderView();

    await waitFor(() => {
      expect(container.querySelector('.holiday-date button')).toBeTruthy();
    });
    const dayButton = container.querySelector('.holiday-date button');
    dayButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitFor(() => {
      expect(container.querySelector('button[aria-label="Close"]')).toBeTruthy();
    });
  });
});
