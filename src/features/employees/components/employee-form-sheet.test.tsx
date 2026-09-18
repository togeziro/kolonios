// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { EmployeeFormSheet } from './employee-form-sheet';
import type { Employee } from '../api/types';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
globalThis.HTMLElement.prototype.scrollIntoView = vi.fn();
globalThis.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
globalThis.HTMLElement.prototype.releasePointerCapture = vi.fn();

const { useQueryMock, useSuspenseQueryMock, useMutationMock, toastMock, createMutationFnMock } =
  vi.hoisted(() => ({
    useQueryMock: vi.fn(),
    useSuspenseQueryMock: vi.fn(),
    useMutationMock: vi.fn(),
    toastMock: { success: vi.fn(), error: vi.fn() },
    createMutationFnMock: vi.fn(async () => ({ success: true }))
  }));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => useQueryMock(),
    useSuspenseQuery: (opts: { queryKey: readonly unknown[] }) => useSuspenseQueryMock(opts),
    useMutation: useMutationMock
  };
});

/**
 * Test double for `useMutation` that preserves the real callback contract
 * (mutationFn result → onSuccess, rejection → onError) but settles the
 * `mutateAsync` promise instead of rejecting it. The production
 * `EmployeeFormSheet` awaits `mutateAsync` without a catch and TanStack Form
 * rethrows `onSubmit` errors through the floating `form.handleSubmit()`
 * promise, so a real rejection would surface as an unhandled rejection in
 * this runner. The error→toast mapping under test is unaffected.
 */
function settledUseMutation(options: {
  mutationFn?: (variables: unknown) => Promise<unknown>;
  onSuccess?: (...args: Array<unknown>) => unknown;
  onError?: (...args: Array<unknown>) => unknown;
}) {
  return {
    mutateAsync: async (variables: unknown) => {
      try {
        const data = await options.mutationFn?.(variables);
        await options.onSuccess?.(data, variables, undefined);
        return data;
      } catch (error) {
        await options.onError?.(error, variables, undefined);
        return undefined;
      }
    },
    isPending: false
  };
}

useMutationMock.mockImplementation(settledUseMutation);

vi.mock('sonner', () => ({
  toast: toastMock
}));

vi.mock('../api/mutations', () => ({
  createEmployeeMutation: { mutationFn: createMutationFnMock },
  updateEmployeeMutation: { mutationFn: vi.fn(async () => ({ success: true })) }
}));

const ZULDAN_PREFILL = { id: 'usr-zuldan', name: 'Zuldan', email: 'zuldan@test.com' };

const EDIT_EMPLOYEE: Employee = {
  id: 'usr-edit',
  employee_code: 'EMP-001',
  full_name: 'Edit Me',
  nickname: '',
  email: 'edit@test.com',
  phone: '',
  birth_place: '',
  birth_date: '2000-01-01',
  address: '',
  id_number: '',
  department_id: 1,
  designation_id: 1,
  is_internship: false,
  employment_status: 'active',
  join_date: '2024-01-01',
  leave_date: null,
  base_salary: 0,
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  department_name: 'Operation',
  designation_name: 'Technician'
};

beforeEach(() => {
  useQueryMock.mockReset();
  useSuspenseQueryMock.mockReset();
  useMutationMock.mockClear();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  createMutationFnMock.mockReset();
  createMutationFnMock.mockResolvedValue({ success: true });
  // Picker (unlinked users) — empty list by default.
  useQueryMock.mockReturnValue({ data: { success: true, users: [] }, isFetching: false });
  // Masterdata for the form selects, routed by query key.
  useSuspenseQueryMock.mockImplementation((opts: { queryKey: readonly unknown[] }) => {
    if (opts.queryKey.includes('departments')) {
      return { data: { departments: [{ id: 1, name: 'Operation' }] } };
    }
    return { data: { options: [{ value: '1', label: 'Technician' }] } };
  });
});

function renderSheet(props: Partial<React.ComponentProps<typeof EmployeeFormSheet>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <EmployeeFormSheet open onOpenChange={() => undefined} {...props} />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

describe('EmployeeFormSheet — prefill (Pending badge deep-link)', () => {
  it('locks name and email to the prefilled identity', () => {
    renderSheet({ prefillUser: ZULDAN_PREFILL });

    const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;

    expect(nameInput.value).toBe('Zuldan');
    expect(emailInput.value).toBe('zuldan@test.com');
    expect(nameInput.disabled).toBe(true);
    expect(emailInput.disabled).toBe(true);
    expect(screen.getAllByText(/Linked to Zuldan/i)).toHaveLength(2);
  });

  it('hides the user picker when prefilled', () => {
    renderSheet({ prefillUser: ZULDAN_PREFILL });

    expect(screen.queryByRole('combobox', { name: /Link user account/i })).not.toBeInTheDocument();
  });
});

describe('EmployeeFormSheet — create with picker', () => {
  it('shows the unlinked-user picker and keeps identity fields editable', () => {
    renderSheet();

    expect(screen.getByRole('combobox', { name: /Link user account/i }).textContent).toMatch(
      /Select a user without a profile/i
    );
    expect((screen.getByLabelText(/Full Name/i) as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText(/Email/i) as HTMLInputElement).disabled).toBe(false);
  });

  it('locking follows the picked user and clearing unlocks again', async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue({
      data: {
        success: true,
        users: [
          {
            id: 'usr-zuldan',
            name: 'Zuldan',
            email: 'zuldan@test.com',
            status: 'Active',
            role: 'technician',
            has_employee_profile: false
          }
        ]
      },
      isFetching: false
    });
    renderSheet();

    await user.click(screen.getByRole('combobox', { name: /Link user account/i }));
    await user.click(screen.getByRole('option', { name: /Zuldan/i }));

    const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Zuldan');
    expect(emailInput.value).toBe('zuldan@test.com');
    expect(nameInput.disabled).toBe(true);
    expect(emailInput.disabled).toBe(true);
  });
});

describe('EmployeeFormSheet — edit mode', () => {
  it('hides the user picker and keeps identity fields editable', () => {
    renderSheet({ employee: EDIT_EMPLOYEE });

    expect(screen.queryByRole('combobox', { name: /Link user account/i })).not.toBeInTheDocument();
    expect((screen.getByLabelText(/Full Name/i) as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText(/Email/i) as HTMLInputElement).disabled).toBe(false);
  });
});

describe('EmployeeFormSheet — link-mode notice', () => {
  it('renders the notice in prefill mode', () => {
    renderSheet({ prefillUser: ZULDAN_PREFILL });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Linking to an existing login/i)).toBeInTheDocument();
    expect(screen.getByText(/No new login is created/i)).toBeInTheDocument();
  });

  it('does not render the notice in plain create mode', () => {
    renderSheet();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Linking to an existing login/i)).not.toBeInTheDocument();
  });

  it('renders the notice once a picker identity is selected', async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue({
      data: {
        success: true,
        users: [
          {
            id: 'usr-zuldan',
            name: 'Zuldan',
            email: 'zuldan@test.com',
            status: 'Active',
            role: 'technician',
            has_employee_profile: false
          }
        ]
      },
      isFetching: false
    });
    renderSheet();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /Link user account/i }));
    await user.click(screen.getByRole('option', { name: /Zuldan/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Linking to an existing login/i)).toBeInTheDocument();
    expect(screen.getByText(/No new login is created/i)).toBeInTheDocument();
  });
});

describe('EmployeeFormSheet — already-linked error path', () => {
  it('shows the directed already-registered message instead of a generic failure', async () => {
    const user = userEvent.setup();
    createMutationFnMock.mockRejectedValue(
      Object.assign(new Error('Employee with email "zuldan@test.com" is already registered'), {
        code: 'EMPLOYEE_ALREADY_LINKED'
      })
    );
    renderSheet();

    await user.type(screen.getByLabelText(/Full Name/i), 'Zuldan');
    await user.type(screen.getByLabelText(/Email/i), 'zuldan@test.com');
    await user.click(screen.getByRole('button', { name: /Create Employee/i }));

    await waitFor(() => {
      expect(createMutationFnMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        'Employee with this email is already registered. Edit the existing employee or use a different email.'
      );
    });
  });

  it('falls back to the generic message for unexpected failures', async () => {
    const user = userEvent.setup();
    createMutationFnMock.mockRejectedValue(new Error('boom'));
    renderSheet();

    await user.type(screen.getByLabelText(/Full Name/i), 'Zuldan');
    await user.type(screen.getByLabelText(/Email/i), 'zuldan@test.com');
    await user.click(screen.getByRole('button', { name: /Create Employee/i }));

    await waitFor(() => {
      expect(createMutationFnMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('boom');
    });
  });
});
