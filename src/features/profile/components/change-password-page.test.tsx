// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { navigateMock, toastMock, getGateMock, rotateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
  getGateMock: vi.fn(async () => false),
  rotateMock: vi.fn(
    async (): Promise<{ ok: true } | { ok: false; code: 'WRONG_CURRENT' | 'GENERIC' }> => ({
      ok: true
    })
  )
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

vi.mock('@/lib/auth/password-gate', () => ({
  getPasswordGateFn: getGateMock,
  rotatePasswordFn: rotateMock
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
  navigateMock.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  getGateMock.mockReset();
  getGateMock.mockResolvedValue(false);
  rotateMock.mockReset();
  rotateMock.mockResolvedValue({ ok: true as const });
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

  it('rotates with the expected args on valid submit and navigates back', async () => {
    renderPage();

    fillField('Current Password', 'OldPass1!');
    fillField('New Password', 'NewPass1!');
    fillField('Confirm New Password', 'NewPass1!');
    await submitForm();

    await waitFor(() => {
      expect(rotateMock).toHaveBeenCalledWith({
        data: {
          currentPassword: 'OldPass1!',
          newPassword: 'NewPass1!'
        }
      });
    });
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: '/dashboard/settings' });
  });

  it('shows the must-change notice when the gate is active', async () => {
    getGateMock.mockResolvedValue(true);
    renderPage();

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      'Your account is using an initial password. Set a new password to unlock the dashboard.'
    );
  });

  it('shows an inline mismatch error and does not rotate', async () => {
    renderPage();

    fillField('Current Password', 'OldPass1!');
    fillField('New Password', 'NewPass1!');
    fillField('Confirm New Password', 'Different1!');
    await submitForm();

    expect(await screen.findByRole('alert').then((el) => el.textContent)).toBe(
      'New password and confirmation do not match.'
    );
    expect(rotateMock).not.toHaveBeenCalled();
  });

  it('rejects weak passwords before rotating', async () => {
    renderPage();

    fillField('Current Password', 'OldPass1!');
    fillField('New Password', 'short');
    fillField('Confirm New Password', 'short');
    await submitForm();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('too weak');
    expect(rotateMock).not.toHaveBeenCalled();
  });

  it('maps a wrong-current-password failure to an inline localized message', async () => {
    rotateMock.mockResolvedValue({ ok: false as const, code: 'WRONG_CURRENT' as const });
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

  it('maps a generic rotation failure without toast or navigation', async () => {
    rotateMock.mockResolvedValue({ ok: false as const, code: 'GENERIC' as const });
    renderPage();

    fillField('Current Password', 'OldPass1!');
    fillField('New Password', 'NewPass1!');
    fillField('Confirm New Password', 'NewPass1!');
    await submitForm();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not change password. Please try again.');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('has no forgot-password affordance anywhere', () => {
    renderPage();
    expect(screen.queryByText(/forgot/i)).toBeNull();
    expect(screen.queryByText(/reset/i)).toBeNull();
  });
});
