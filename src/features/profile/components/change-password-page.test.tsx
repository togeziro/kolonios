// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { navigateMock, changePasswordMock, toastMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  changePasswordMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('sonner', () => ({
  toast: toastMock
}));

vi.mock('@/lib/auth/auth-client', () => ({
  authClient: {
    changePassword: changePasswordMock,
    updateUser: vi.fn()
  },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, isPending: false })
}));

import ChangePasswordPage from './change-password-page';

function renderPage() {
  render(
    <I18nextProvider i18n={i18n}>
      <ChangePasswordPage />
    </I18nextProvider>
  );
}

function fillField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function submitForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
}

beforeEach(() => {
  changePasswordMock.mockReset();
  navigateMock.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});

describe('ChangePasswordPage', () => {
  it('renders the three password fields and the strength meter', () => {
    renderPage();

    expect(screen.getByLabelText('Current Password')).toBeTruthy();
    expect(screen.getByLabelText('New Password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm New Password')).toBeTruthy();
    expect(screen.getByTestId('strength-meter')).toBeTruthy();
  });

  it('shows no strength label while the new password is empty', () => {
    renderPage();
    expect(screen.queryByTestId('strength-label')).toBeNull();
  });

  it('reacts to the new-password value with a labeled tier', () => {
    renderPage();
    fillField('New Password', 'Str0ng!Passw0rd');
    expect(screen.getByTestId('strength-label').textContent).toBe('Strong');
  });

  it('calls changePassword with the expected args on valid submit and navigates back', async () => {
    changePasswordMock.mockResolvedValue({ data: {}, error: null });
    renderPage();

    fillField('Current Password', 'OldPass1!');
    fillField('New Password', 'NewPass1!');
    fillField('Confirm New Password', 'NewPass1!');
    await submitForm();

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!'
      });
    });
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: '/dashboard/settings' });
  });

  it('shows an inline mismatch error and does not call changePassword', async () => {
    renderPage();

    fillField('Current Password', 'OldPass1!');
    fillField('New Password', 'NewPass1!');
    fillField('Confirm New Password', 'Different1!');
    await submitForm();

    expect(await screen.findByRole('alert').then((el) => el.textContent)).toBe(
      'New password and confirmation do not match.'
    );
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('rejects weak passwords before calling auth', async () => {
    renderPage();

    fillField('Current Password', 'OldPass1!');
    fillField('New Password', 'short');
    fillField('Confirm New Password', 'short');
    await submitForm();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('too weak');
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('maps an API failure (wrong current password) to an inline localized message', async () => {
    changePasswordMock.mockResolvedValue({
      data: null,
      error: { message: 'Invalid password', status: 401 }
    });
    renderPage();

    fillField('Current Password', 'WrongPass1!');
    fillField('New Password', 'NewPass1!');
    fillField('Confirm New Password', 'NewPass1!');
    await submitForm();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Current password is incorrect.');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('has no forgot-password affordance anywhere', () => {
    renderPage();
    expect(screen.queryByText(/forgot/i)).toBeNull();
    expect(screen.queryByText(/reset/i)).toBeNull();
  });
});
