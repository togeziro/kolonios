// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { useWorklogSettingsMock, setWorklogSettingsMock } = vi.hoisted(() => ({
  useWorklogSettingsMock: vi.fn(),
  setWorklogSettingsMock: vi.fn()
}));

vi.mock('../api/queries', () => ({
  useWorklogSettings: useWorklogSettingsMock
}));

vi.mock('../api/mutations', () => ({
  useSetWorklogSettings: () => ({
    mutateAsync: setWorklogSettingsMock,
    isPending: false
  })
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}));

import { WorklogSettingsCard } from './worklog-settings-card';

function renderCard() {
  return render(
    <I18nextProvider i18n={i18n}>
      <WorklogSettingsCard />
    </I18nextProvider>
  );
}

describe('WorklogSettingsCard', () => {
  it('renders the switch in the unchecked state when policy is false', () => {
    useWorklogSettingsMock.mockReturnValue({ data: { lenient: false }, isLoading: false });
    renderCard();
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('data-state')).toBe('unchecked');
  });

  it('renders the switch in the checked state when policy is true', () => {
    useWorklogSettingsMock.mockReturnValue({ data: { lenient: true }, isLoading: false });
    renderCard();
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('data-state')).toBe('checked');
  });

  it('flips the switch and calls the mutation', async () => {
    useWorklogSettingsMock.mockReturnValue({ data: { lenient: false }, isLoading: false });
    setWorklogSettingsMock.mockResolvedValue({ lenient: true });
    renderCard();
    const sw = screen.getByRole('switch');
    fireEvent.click(sw);
    await waitFor(() => expect(setWorklogSettingsMock).toHaveBeenCalledWith({ lenient: true }));
  });

  it('shows an error message when the query fails', () => {
    useWorklogSettingsMock.mockReturnValue({ isError: true, isLoading: false });
    renderCard();
    expect(screen.getByText(/Could not load work log settings/i)).toBeTruthy();
  });
});
