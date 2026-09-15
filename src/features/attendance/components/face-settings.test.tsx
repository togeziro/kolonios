// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import en from '@/i18n/locales/en/translation.json';
import id from '@/i18n/locales/id/translation.json';
import { FaceSettings } from './face-settings';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const updateFaceSettingsFnMock = vi.fn();

vi.mock('@/features/face/api/service', () => ({
  updateFaceSettingsFn: (...args: unknown[]) => updateFaceSettingsFnMock(...args)
}));

vi.mock('@/features/face/api/queries', () => ({
  faceSettingsQueryOptions: () => ({
    queryKey: ['face', 'settings'],
    queryFn: async () => ({
      validationMode: 'background',
      accuracyLevel: 'medium',
      showSeconds: false
    })
  })
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

function renderFaceSettings() {
  const queryClient = new QueryClient();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <FaceSettings />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  updateFaceSettingsFnMock.mockReset();
  i18n.changeLanguage('en');
});

describe('FaceSettings honest background-mode label', () => {
  it('shows the not-yet-in-effect note next to the background option', async () => {
    renderFaceSettings();
    expect(
      await screen.findByText('Not yet in effect — check-ins always verify in realtime.')
    ).toBeTruthy();
  });

  it('round-trips locale: Indonesian note in id mode', async () => {
    await i18n.changeLanguage('id');
    renderFaceSettings();
    expect(
      await screen.findByText('Belum berlaku — check-in selalu diverifikasi secara realtime.')
    ).toBeTruthy();
  });

  it('keeps the stored value meaning: saving background persists "background"', async () => {
    updateFaceSettingsFnMock.mockResolvedValue({ success: true });
    renderFaceSettings();
    await screen.findByText('Not yet in effect — check-ins always verify in realtime.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateFaceSettingsFnMock).toHaveBeenCalledTimes(1));
    const payload = updateFaceSettingsFnMock.mock.calls[0]?.[0] as
      | { data: { validationMode: string } }
      | undefined;
    expect(payload?.data.validationMode).toBe('background');
  });

  it('has i18n parity for the honest label keys', () => {
    type FaceSettingsLocale = { faceSettings?: Record<string, string> };
    for (const key of ['background', 'backgroundNote', 'realtime'] as const) {
      expect((en.faceSettings as Record<string, string>)[key]).toBeDefined();
      expect(((id as FaceSettingsLocale).faceSettings ?? {})[key]).toBeDefined();
    }
  });
});
