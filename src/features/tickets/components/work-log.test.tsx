// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { uploadTicketPhotoMock, toastMock } = vi.hoisted(() => ({
  uploadTicketPhotoMock: vi.fn(),
  toastMock: { error: vi.fn(), success: vi.fn() }
}));

vi.mock('@/features/attendance/components/selfie-capture', () => ({
  SelfieCapture: ({ onCapture }: { onCapture: (dataUrl: string) => void }) => (
    <button type='button' onClick={() => onCapture('data:image/jpeg;base64,x')}>
      capture-photo
    </button>
  )
}));

vi.mock('@/lib/storage/upload-client', () => ({
  uploadTicketPhoto: uploadTicketPhotoMock
}));

vi.mock('sonner', () => ({
  toast: toastMock
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

beforeEach(() => {
  uploadTicketPhotoMock.mockReset();
  toastMock.error.mockReset();
  toastMock.success.mockReset();
});

describe('WorkLog add-location flow', () => {
  it('shows "Add location" button when no location entry exists', () => {
    renderLog([]);
    expect(screen.getByRole('button', { name: /add location/i })).toBeInTheDocument();
  });

  it('opens the location picker dialog on click', async () => {
    const user = userEvent.setup();
    renderLog([]);
    await user.click(screen.getByRole('button', { name: /add location/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm location/i })).toBeInTheDocument();
  });

  it('adds a location entry when the dialog is confirmed', async () => {
    const user = userEvent.setup();
    const { onChange } = renderLog([]);
    await user.click(screen.getByRole('button', { name: /add location/i }));
    await user.click(screen.getByRole('button', { name: /simulate-locate/i }));
    await user.click(screen.getByRole('button', { name: /confirm location/i }));

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
    expect(screen.getByRole('button', { name: /location recorded/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add location/i })).not.toBeInTheDocument();
  });

  it('can close the dialog without confirming', async () => {
    const user = userEvent.setup();
    renderLog([]);
    await user.click(screen.getByRole('button', { name: /add location/i }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('WorkLog photo upload retry', () => {
  it('keeps the captured photo and offers a retry button when upload fails', async () => {
    const user = userEvent.setup();
    uploadTicketPhotoMock.mockRejectedValue(new Error('PHOTO_UPLOAD_FAILED'));
    const { onChange } = renderLog([]);

    await user.click(screen.getByRole('button', { name: /capture-photo/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry upload/i })).toBeInTheDocument();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalled();
  });

  it('uploads the pending photo again on retry and appends the entry', async () => {
    const user = userEvent.setup();
    uploadTicketPhotoMock.mockRejectedValueOnce(new Error('PHOTO_UPLOAD_FAILED'));
    uploadTicketPhotoMock.mockResolvedValueOnce('tickets/0/9.jpg');
    const { onChange } = renderLog([]);

    await user.click(screen.getByRole('button', { name: /capture-photo/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry upload/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /retry upload/i }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ kind: 'photo', body: 'tickets/0/9.jpg' })
      ]);
    });
    expect(uploadTicketPhotoMock).toHaveBeenCalledTimes(2);
  });

  it('disables the retry button while a retry upload is in flight', async () => {
    const user = userEvent.setup();
    let resolveUpload: (key: string) => void = () => undefined;
    uploadTicketPhotoMock
      .mockRejectedValueOnce(new Error('PHOTO_UPLOAD_FAILED'))
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveUpload = resolve;
          })
      );
    renderLog([]);

    await user.click(screen.getByRole('button', { name: /capture-photo/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry upload/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /retry upload/i }));
    expect(
      (screen.getByRole('button', { name: /retry upload/i }) as HTMLButtonElement).disabled
    ).toBe(true);

    resolveUpload('tickets/0/10.jpg');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /retry upload/i })).not.toBeInTheDocument()
    );
  });
});
