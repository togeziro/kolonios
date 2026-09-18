// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
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

async function fillField(user: UserEvent, label: string, value: string) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}

async function submitForm(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Update Password' }));
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

    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    expect(screen.getByTestId('strength-meter')).toBeInTheDocument();
  });

  it('shows no strength label while the new password is empty', () => {
    renderPage();
    expect(screen.queryByTestId('strength-label')).not.toBeInTheDocument();
  });

  it('reacts to the new-password value with a labeled tier', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillField(user, 'New Password', 'Str0ng!Passw0rd');
    expect(screen.getByTestId('strength-label').textContent).toBe('Strong');
  });

  it('rotates with the expected args on valid submit and navigates back', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillField(user, 'Current Password', 'OldPass1!');
    await fillField(user, 'New Password', 'NewPass1!');
    await fillField(user, 'Confirm New Password', 'NewPass1!');
    await submitForm(user);

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
    const user = userEvent.setup();
    renderPage();

    await fillField(user, 'Current Password', 'OldPass1!');
    await fillField(user, 'New Password', 'NewPass1!');
    await fillField(user, 'Confirm New Password', 'Different1!');
    await submitForm(user);

    expect(await screen.findByRole('alert').then((el) => el.textContent)).toBe(
      'New password and confirmation do not match.'
    );
    expect(rotateMock).not.toHaveBeenCalled();
  });

  it('rejects weak passwords before rotating', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillField(user, 'Current Password', 'OldPass1!');
    await fillField(user, 'New Password', 'short');
    await fillField(user, 'Confirm New Password', 'short');
    await submitForm(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('too weak');
    expect(rotateMock).not.toHaveBeenCalled();
  });

  it('maps a wrong-current-password failure to an inline localized message', async () => {
    const user = userEvent.setup();
    rotateMock.mockResolvedValue({ ok: false as const, code: 'WRONG_CURRENT' as const });
    renderPage();

    await fillField(user, 'Current Password', 'WrongPass1!');
    await fillField(user, 'New Password', 'NewPass1!');
    await fillField(user, 'Confirm New Password', 'NewPass1!');
    await submitForm(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Current password is incorrect.');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('maps a generic rotation failure without toast or navigation', async () => {
    const user = userEvent.setup();
    rotateMock.mockResolvedValue({ ok: false as const, code: 'GENERIC' as const });
    renderPage();

    await fillField(user, 'Current Password', 'OldPass1!');
    await fillField(user, 'New Password', 'NewPass1!');
    await fillField(user, 'Confirm New Password', 'NewPass1!');
    await submitForm(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Could not change password. Please try again.');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('has no forgot-password affordance anywhere', () => {
    renderPage();
    expect(screen.queryByText(/forgot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reset/i)).not.toBeInTheDocument();
  });
});
