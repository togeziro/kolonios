// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StorageSettings } from './storage-settings';
import '@/i18n/config';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

vi.mock('@/features/storage/api', () => ({
  useStorageSettings: () => ({
    data: {
      configured: true,
      settings: {
        provider: 'idrive_e2',
        endpoint: '',
        region: 'us-east-1',
        bucket: 'koloni-dev',
        accessKeyId: 'ak',
        secretKeyMasked: '••••sk',
        forcePathStyle: false
      }
    },
    isLoading: false,
    isError: false
  }),
  useUpdateStorageSettings: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(StorageSettings)));
}

describe('StorageSettings', () => {
  it('renders the bucket, masked secret hint, and a blank secret field', async () => {
    renderSettings();
    await waitFor(() => expect(screen.getByDisplayValue('koloni-dev')).toBeTruthy());
    expect(screen.getByText(/••••sk/)).toBeTruthy();
    const secretInput = screen.getByLabelText(/secret/i) as HTMLInputElement;
    expect(secretInput.value).toBe('');
  });
});
