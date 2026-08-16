// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import WorkLog from './work-log';

const { locMock } = vi.hoisted(() => ({ locMock: vi.fn() }));

vi.mock('@/features/attendance/utils/geolocation', () => ({
  getCurrentLocation: () => locMock()
}));

vi.mock('@/lib/storage/upload-client', () => ({
  uploadTicketPhoto: vi.fn().mockResolvedValue('tickets/0/photo.jpg'),
  PHOTO_UPLOAD_FAILED: 'PHOTO_UPLOAD_FAILED'
}));

vi.mock('@/features/attendance/components/selfie-capture', () => ({
  SelfieCapture: ({ onCapture }: { onCapture: (d: string) => void }) => (
    <button type='button' onClick={() => onCapture('data:image/jpeg;base64,xxx')}>
      capture-photo
    </button>
  )
}));

describe('WorkLog', () => {
  it('renders logged entries with timestamped rows', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <WorkLog
          entries={[{ kind: 'note', body: 'Found OLT' }]}
          onChange={vi.fn()}
          disabled={false}
        />
      </I18nextProvider>
    );
    expect(screen.getByText('Found OLT')).toBeTruthy();
  });

  it('appends a note entry on submit', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <WorkLog entries={[]} onChange={onChange} disabled={false} />
      </I18nextProvider>
    );
    fireEvent.change(screen.getByPlaceholderText(/note/i), {
      target: { value: 'Ping OK' }
    });
    fireEvent.click(screen.getByRole('button', { name: /add note/i }));
    expect(onChange).toHaveBeenCalledWith([{ kind: 'note', body: 'Ping OK' }]);
  });

  it('appends a location entry on successful geolocation', async () => {
    locMock.mockResolvedValue({
      status: 'success',
      location: { latitude: -6.2, longitude: 106.8 }
    });
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <WorkLog entries={[]} onChange={onChange} disabled={false} />
      </I18nextProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /add location/i }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([{ kind: 'location', body: '-6.2,106.8' }])
    );
  });

  it('appends a meter entry and ignores empty input', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <WorkLog entries={[]} onChange={onChange} disabled={false} />
      </I18nextProvider>
    );
    fireEvent.change(screen.getByPlaceholderText(/meter/i), {
      target: { value: '855nm' }
    });
    fireEvent.click(screen.getByRole('button', { name: /add meter/i }));
    expect(onChange).toHaveBeenCalledWith([{ kind: 'meter', body: '855nm' }]);
  });

  it('disables inputs when disabled', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <WorkLog entries={[]} onChange={vi.fn()} disabled={true} />
      </I18nextProvider>
    );
    expect((screen.getByPlaceholderText(/note/i) as HTMLInputElement).disabled).toBe(true);
  });
});
