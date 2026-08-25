// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { navigateMock, signOutMock, setThemeMock, applyLanguageMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signOutMock: vi.fn(),
  setThemeMock: vi.fn(),
  applyLanguageMock: vi.fn()
}));

vi.mock('@/lib/auth/auth-client', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'u1',
        name: 'Budi Santoso',
        email: 'budi@example.com',
        role: 'technician',
        image: null
      }
    }
  }),
  signOut: signOutMock
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useRouter: () => ({ navigate: navigateMock })
  };
});

vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: setThemeMock })
}));

vi.mock('@/lib/preferences/language', () => ({
  applyLanguage: applyLanguageMock
}));

import SettingsPage from './settings-page';
import { APP_VERSION } from '@/lib/version';

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <SettingsPage />
    </I18nextProvider>
  );
}

describe('SettingsPage', () => {
  it('renders profile card with name and edit link', () => {
    renderPage();
    expect(screen.getByText('Budi Santoso')).toBeTruthy();
    const editLink = screen.getByRole('link', { name: /edit/i });
    expect(editLink.getAttribute('href')).toBe('/dashboard/edit-profile');
  });

  it('renders preferences rows for language and theme', () => {
    renderPage();
    expect(screen.getByText(/language/i)).toBeTruthy();
    expect(screen.getByText(/^theme$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^english$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^indonesia$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^light$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^dark$/i })).toBeTruthy();
  });

  it('switches language live when a language option is tapped', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^indonesia$/i }));
    expect(applyLanguageMock).toHaveBeenCalledWith(expect.anything(), 'id');
  });

  it('applies theme instantly when light/dark is tapped', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }));
    expect(setThemeMock).toHaveBeenCalledWith('light');
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('links to change password', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /change password/i });
    expect(link.getAttribute('href')).toBe('/dashboard/change-password');
  });

  it('shows the app version in the about row', () => {
    renderPage();
    expect(screen.getByText(APP_VERSION)).toBeTruthy();
  });

  it('signs out and lands on auth root when log out is tapped', async () => {
    signOutMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /log out|sign out/i }));
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
    });
  });

  it('does not render notifications or help rows', () => {
    renderPage();
    expect(screen.queryByText(/help & support/i)).toBeNull();
    expect(screen.queryByText(/notification preferences/i)).toBeNull();
  });
});
