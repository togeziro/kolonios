// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

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
  signOut: vi.fn()
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    )
  };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ data: undefined, isLoading: false })
  };
});

vi.mock('@/features/attendance/api/queries', () => ({
  attendanceSummaryQueryOptions: () => ({ queryKey: ['attendance', 'summary'], queryFn: vi.fn() })
}));

vi.mock('@/features/tickets/api/queries', () => ({
  myTicketsQueryOptions: () => ({ queryKey: ['tickets', 'mine'], queryFn: vi.fn() })
}));

import ProfilePage from './profile-page';

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ProfilePage />
    </I18nextProvider>
  );
}

describe('ProfilePage', () => {
  it('renders profile header with name, email and role', () => {
    renderPage();
    expect(screen.getByText('Budi Santoso')).toBeTruthy();
    expect(screen.getByText('budi@example.com')).toBeTruthy();
    expect(screen.getByText('technician')).toBeTruthy();
  });

  it('renders work stats from real data sources', () => {
    renderPage();
    expect(screen.getByText(/this month/i)).toBeTruthy();
  });

  it('renders menu links to settings, edit profile, change password and daily checklist', () => {
    renderPage();
    const expected: [RegExp, string][] = [
      [/^settings$/i, '/dashboard/settings'],
      [/^edit profile$/i, '/dashboard/edit-profile'],
      [/^change password$/i, '/dashboard/change-password']
    ];
    for (const [name, href] of expected) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('href')).toBe(href);
    }
    expect(screen.getByRole('link', { name: /daily checklist/i }).getAttribute('href')).toBe(
      '/dashboard/daily-checklist'
    );
  });

  it('no longer offers log out on profile — it lives on settings', () => {
    renderPage();
    expect(screen.queryByText(/sign out|log out/i)).toBeNull();
  });
});
