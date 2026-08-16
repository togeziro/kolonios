// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

vi.mock('@/features/attendance/components/selfie-capture', () => ({
  SelfieCapture: () => null
}));

vi.mock('@/lib/storage/upload-client', () => ({
  uploadTicketPhoto: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}));

vi.mock('@/components/ui/map', () => ({
  Map: ({ onChange }: { onChange: (c: { lat: number; lng: number }) => void }) => (
    <div data-testid='mock-map'>
      <button type='button' onClick={() => onChange({ lat: -6.2088, lng: 106.8456 })}>
        simulate-locate
      </button>
    </div>
  )
}));

import WorkLog from './work-log';
import type { WorkLogEntryInput } from '../api/types';

function renderLog(
  entries: WorkLogEntryInput[] = [],
  onChange?: (next: WorkLogEntryInput[]) => void
) {
  const mockChange = onChange ?? vi.fn();
  return {
    onChange: mockChange,
    ...render(
      <I18nextProvider i18n={i18n}>
        <WorkLog entries={entries} onChange={mockChange} />
      </I18nextProvider>
    )
  };
}

describe('WorkLog add-location flow', () => {
  it('shows "Add location" button when no location entry exists', () => {
    renderLog([]);
    expect(screen.getByRole('button', { name: /add location/i })).toBeTruthy();
  });

  it('opens the location picker dialog on click', () => {
    renderLog([]);
    fireEvent.click(screen.getByRole('button', { name: /add location/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: /confirm location/i })).toBeTruthy();
  });

  it('adds a location entry when the dialog is confirmed', () => {
    const { onChange } = renderLog([]);
    fireEvent.click(screen.getByRole('button', { name: /add location/i }));
    fireEvent.click(screen.getByRole('button', { name: /simulate-locate/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm location/i }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'location',
        body: expect.stringContaining('-6.2088')
      })
    ]);
  });

  it('shows "Location recorded" and disables the button after confirm', () => {
    const locationEntry: WorkLogEntryInput = {
      kind: 'location',
      body: '-6.2088,106.8456 ±50m'
    };
    renderLog([locationEntry]);
    expect(screen.getByRole('button', { name: /location recorded/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add location/i })).toBeNull();
  });

  it('can close the dialog without confirming', () => {
    renderLog([]);
    fireEvent.click(screen.getByRole('button', { name: /add location/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
