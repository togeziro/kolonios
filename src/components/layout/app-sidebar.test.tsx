// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './app-sidebar';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

beforeEach(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }));
});

vi.mock('@/lib/auth/auth-client', () => ({
  authClient: {
    signOut: vi.fn()
  },
  useSession: vi.fn()
}));

vi.mock('@/hooks/use-nav', () => ({
  useFilteredNavItems: () => [],
  useRoleGroupPermissions: () => ({ isAdmin: false, permissions: {} })
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/dashboard/overview' }),
  useRouter: () => ({ navigate: vi.fn() })
}));

import { useSession } from '@/lib/auth/auth-client';

describe('AppSidebar footer', () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
      error: null
    } as never);
  });

  it('renders the signed-in user name and email', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { name: 'Budi Santoso', email: 'budi@example.com' }
      },
      isPending: false,
      error: null
    } as never);

    render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </I18nextProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Budi Santoso')).toBeTruthy();
    expect(screen.getByText('budi@example.com')).toBeTruthy();
    expect(screen.queryByText('user@example.com')).toBeNull();
  });
});
