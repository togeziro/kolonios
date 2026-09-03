// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { uploadTicketPhotoMock } = vi.hoisted(() => ({
  uploadTicketPhotoMock: vi.fn()
}));

vi.mock('@/lib/storage/upload-client', () => ({
  PHOTO_UPLOAD_FAILED: 'PHOTO_UPLOAD_FAILED',
  uploadTicketPhoto: uploadTicketPhotoMock
}));

vi.mock('@/features/attendance/components/selfie-capture', () => ({
  SelfieCapture: ({
    onCapture,
    'data-testid': testId
  }: {
    onCapture: (dataUrl: string) => void;
    'data-testid'?: string;
  }) => (
    <button
      type='button'
      data-testid={testId ?? 'capture'}
      onClick={() => onCapture('data:image/jpeg;base64,x')}
    >
      capture
    </button>
  )
}));

import CompletionPhotos from './completion-photos';

describe('CompletionPhotos', () => {
  it('uploads the captured photo and reports its key via onChange', async () => {
    uploadTicketPhotoMock.mockResolvedValue('tickets/0/99.jpg');
    const onChange = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <CompletionPhotos onChange={onChange} />
      </I18nextProvider>
    );

    fireEvent.click(screen.getAllByRole('button', { name: /capture/i })[0]);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['tickets/0/99.jpg']));
  });

  it('does not report a key when the upload fails', async () => {
    uploadTicketPhotoMock.mockRejectedValue(new Error('PHOTO_UPLOAD_FAILED'));
    const onChange = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <CompletionPhotos onChange={onChange} />
      </I18nextProvider>
    );

    fireEvent.click(screen.getAllByRole('button', { name: /capture/i })[0]);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([]));
  });
});
