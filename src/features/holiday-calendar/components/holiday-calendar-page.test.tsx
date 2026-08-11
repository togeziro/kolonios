// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HolidayCalendarPage } from './holiday-calendar-page';
import '@/i18n/config';

vi.mock('@/features/holiday-calendar/api/queries', () => ({
  nationalHolidaysQueryOptions: () => ({
    queryKey: ['holidays', 'list', undefined],
    queryFn: async () => ({ holidays: [] })
  })
}));

vi.mock('@/features/holiday-calendar/api/mutations', () => ({
  useCreateNationalHoliday: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateNationalHoliday: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useImportHolidaysFromApi: () => ({ mutate: vi.fn(), isPending: false })
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(HolidayCalendarPage)));
}

describe('HolidayCalendarPage', () => {
  it('renders tab content with flex classes so the DataTable height chain holds', () => {
    const { container } = renderPage();

    const content = container.querySelector('[data-slot="tabs-content"]');
    expect(content).toBeTruthy();
    const classes = content!.getAttribute('class') ?? '';
    expect(classes).toContain('flex-col');
    expect(classes).toContain('min-h-0');
    expect(classes).toContain('flex-1');
  });
});
