// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocaleProvider } from './locale-provider';
import { useAppLocale } from '@/lib/locale/context';
import { getAppLocale } from '@/lib/locale/state';

vi.mock('@/features/settings/api', () => ({
  useAppLocale: (): string => 'en-US'
}));

function Probe() {
  const locale = useAppLocale();
  return <div data-testid='locale'>{locale}</div>;
}

describe('LocaleProvider', () => {
  it('starts at id-ID and adopts the server locale', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <LocaleProvider>
          <Probe />
        </LocaleProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByTestId('locale').textContent).toBe('en-US'));
    expect(getAppLocale()).toBe('en-US');
  });
});
