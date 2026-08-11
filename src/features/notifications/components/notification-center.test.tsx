// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { NotificationCenter } from './notification-center';
import type { NotificationItem } from '../api/types';

const notificationListQueryOptions = vi.hoisted(() => vi.fn());
const markAsReadMutation = vi.hoisted(() => vi.fn());
const markAllAsReadMutation = vi.hoisted(() => vi.fn());

vi.mock('../api/queries', () => ({
  notificationListQueryOptions
}));

vi.mock('../api/mutations', () => ({
  markAsReadMutation,
  markAllAsReadMutation
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useRouter: () => ({ navigate: vi.fn() })
}));

const sample: NotificationItem[] = [
  {
    id: '1',
    title: 'Welcome',
    body: 'Hello there',
    status: 'unread',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

describe('NotificationCenter', () => {
  it('renders notifications returned as a raw array by the server fn', async () => {
    notificationListQueryOptions.mockReturnValue({
      queryKey: ['notifications', 'list'],
      queryFn: async () => sample
    });

    const queryClient = new QueryClient();
    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <NotificationCenter />
        </QueryClientProvider>
      </I18nextProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() => expect(screen.getByText('Welcome')).toBeTruthy());
  });
});
