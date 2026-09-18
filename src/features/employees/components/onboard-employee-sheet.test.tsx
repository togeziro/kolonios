// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { OnboardEmployeeSheet } from './onboard-employee-sheet';
import { onboardFormSchema } from '../api/validation';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
globalThis.HTMLElement.prototype.scrollIntoView = vi.fn();
globalThis.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
globalThis.HTMLElement.prototype.releasePointerCapture = vi.fn();

const { useQueryMock, useSuspenseQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useSuspenseQueryMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => useQueryMock(),
    useSuspenseQuery: (opts: { queryKey: readonly unknown[] }) => useSuspenseQueryMock(opts)
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

beforeEach(() => {
  useQueryMock.mockReset();
  useSuspenseQueryMock.mockReset();
  // Role groups dropdown.
  useQueryMock.mockReturnValue({
    data: { role_groups: [{ id: 'rg-tech', name: 'Technician' }] }
  });
  useSuspenseQueryMock.mockImplementation((opts: { queryKey: readonly unknown[] }) => {
    if (opts.queryKey.includes('departments')) {
      return { data: { departments: [{ id: 1, name: 'Operation' }] } };
    }
    return { data: { options: [{ value: '1', label: 'Technician' }] } };
  });
});

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <OnboardEmployeeSheet open onOpenChange={() => undefined} />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

describe('OnboardEmployeeSheet', () => {
  it('renders account + employment sections in one form', () => {
    renderSheet();

    expect(screen.getByText('Account')).not.toBeNull();
    expect(screen.getByText('Employment')).not.toBeNull();
    expect(screen.getByLabelText(/Full Name/i)).not.toBeNull();
    expect(screen.getByLabelText(/Email/i)).not.toBeNull();
    expect(screen.getByLabelText(/Access Level/i)).not.toBeNull();
    expect(screen.getByLabelText(/Birth Date/i)).not.toBeNull();
    expect(screen.getByLabelText(/Join Date/i)).not.toBeNull();
    expect(screen.getByRole('button', { name: /Onboard Employee/i })).not.toBeNull();
  });

  it('explains the blank-password auto-generate contract', () => {
    renderSheet();

    expect(screen.getByText(/auto-generate a one-time password/i)).not.toBeNull();
  });
});

describe('onboardFormSchema', () => {
  const valid = {
    full_name: 'Zuldan',
    email: 'zuldan@test.com',
    birth_date: '2000-01-01',
    department_id: '1',
    designation_id: '1',
    join_date: '2026-09-18'
  };

  it('accepts a complete minimal payload with blank password (generate for me)', () => {
    expect(() => onboardFormSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid email', () => {
    const res = onboardFormSchema.safeParse({ ...valid, email: 'not-an-email' });

    expect(res.success).toBe(false);
  });

  it('rejects mismatched password confirmation', () => {
    const res = onboardFormSchema.safeParse({
      ...valid,
      password: 'Password123!',
      confirmPassword: 'SomethingElse!'
    });

    expect(res.success).toBe(false);
  });

  it('rejects a provided-but-weak password', () => {
    const res = onboardFormSchema.safeParse({ ...valid, password: 'short' });

    expect(res.success).toBe(false);
  });

  it('rejects a missing department (Complete minimal)', () => {
    const res = onboardFormSchema.safeParse({ ...valid, department_id: '' });

    expect(res.success).toBe(false);
  });
});
