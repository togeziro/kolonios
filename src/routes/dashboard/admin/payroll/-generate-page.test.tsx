// @vitest-environment jsdom
// i18n:skip
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { GeneratePage } from './-generate-page';

const { useQueryMock, useGeneratePayrollMock, mutateAsyncMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useGeneratePayrollMock: vi.fn(),
  mutateAsyncMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => useQueryMock() };
});

vi.mock('@/features/payroll/api/mutations', () => ({
  useGeneratePayroll: useGeneratePayrollMock
}));

vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => ({
    isAdmin: true,
    permissions: { payroll: { edit: true } }
  })
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}));

function setPeriodsLoaded() {
  useQueryMock.mockReturnValue({
    data: {
      rows: [
        {
          id: 1,
          name: 'Jan 2026',
          status: 'draft',
          period_start: '2026-01-01',
          period_end: '2026-01-31',
          payment_date: '2026-02-05'
        }
      ]
    },
    isLoading: false,
    isError: false,
    error: null
  });
}

function setMutatePending(isPending: boolean) {
  useGeneratePayrollMock.mockReturnValue({
    mutateAsync: mutateAsyncMock,
    isPending,
    isError: false,
    error: null
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <GeneratePage />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

function pickPeriod() {
  fireEvent.change(screen.getByLabelText('Payroll Periods'), { target: { value: '1' } });
}

describe('Generate payroll page — double-click guard', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockImplementation(() => Promise.resolve(undefined));
  });

  it('disables the Generate button while the mutation is pending', () => {
    setPeriodsLoaded();
    setMutatePending(true);
    renderPage();
    pickPeriod();
    const btn = screen.getByRole('button', { name: /Generating/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('marks the button aria-busy while pending', () => {
    setPeriodsLoaded();
    setMutatePending(true);
    renderPage();
    pickPeriod();
    const btn = screen.getByRole('button', { name: /Generating/i }) as HTMLButtonElement;
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('does not fire mutateAsync when onClick fires repeatedly while pending', () => {
    setPeriodsLoaded();
    setMutatePending(true);
    renderPage();
    pickPeriod();
    const btn = screen.getByRole('button', { name: /Generating/i }) as HTMLButtonElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('fires mutateAsync exactly once on a single click when not pending', () => {
    setPeriodsLoaded();
    setMutatePending(false);
    renderPage();
    pickPeriod();
    const btn = screen.getByRole('button', { name: /Generate Payroll/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).toHaveBeenCalledWith({ payrollPeriodId: 1 });
  });

  it('does not fire mutateAsync a second time when clicked twice in rapid succession (guard)', () => {
    setPeriodsLoaded();
    // mutateAsync never resolves so the second click test runs before any
    // pending-state re-render could possibly reach the button.
    mutateAsyncMock.mockImplementation(() => new Promise(() => {}));
    setMutatePending(false);
    renderPage();
    pickPeriod();
    const btn = screen.getByRole('button', { name: /Generate Payroll/i }) as HTMLButtonElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
  });
});
