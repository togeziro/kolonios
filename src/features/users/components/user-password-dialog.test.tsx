// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { toastMock, mutationFnMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
  mutationFnMock: vi.fn(async () => ({ success: true }))
}));

vi.mock('sonner', () => ({
  toast: toastMock
}));

vi.mock('../api/mutations', () => ({
  setUserPasswordMutation: {
    mutationFn: mutationFnMock,
    onSuccess: undefined
  }
}));

import { UserPasswordDialog } from './user-password-dialog';
import type { User } from '../api/types';

const demoUser: User = {
  id: 'usr-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  status: 'Active',
  role: 'admin',
  role_group_id: null,
  role_group_name: null,
  has_employee_profile: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <UserPasswordDialog user={demoUser} open onOpenChange={() => {}} />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

async function openForm() {
  await screen.findByLabelText('New Password');
}

function submitButton() {
  return screen.getByRole('button', { name: /set password/i });
}

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  mutationFnMock.mockReset();
  mutationFnMock.mockResolvedValue({ success: true });
});

describe('UserPasswordDialog', () => {
  it('rejects a short password without calling the server', async () => {
    renderDialog();
    await openForm();
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'short' }
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'short' }
    });
    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(mutationFnMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirmation', async () => {
    renderDialog();
    await openForm();
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'n3w!!passw0rd' }
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'different!!' }
    });
    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(mutationFnMock).not.toHaveBeenCalled();
  });

  it('submits matching passwords and shows a success toast', async () => {
    renderDialog();
    await openForm();
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'n3w!!passw0rd' }
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'n3w!!passw0rd' }
    });
    fireEvent.click(submitButton());

    await waitFor(() => {
      expect(mutationFnMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr-1',
          newPassword: 'n3w!!passw0rd'
        }),
        expect.anything()
      );
    });
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
  });
});
