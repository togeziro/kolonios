// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { clearSelfieAfterSuccess } from './attendance-check-card';
import AttendanceCheckCard from './attendance-check-card';

// The card's import graph pulls in maplibre-gl (via location-map); stub it so
// importing the module under test is safe in jsdom.
class MockMap {
  addControl = vi.fn();
  addSource = vi.fn();
  addLayer = vi.fn();
  on = vi.fn();
  getSource = vi.fn(() => ({ setData: vi.fn() }));
  remove = vi.fn();
}

class MockMarker {
  setLngLat = vi.fn(() => this);
  addTo = vi.fn(() => this);
  on = vi.fn();
  getLngLat = vi.fn(() => ({ lat: 0, lng: 0 }));
}

class MockNavigationControl {
  render = vi.fn();
}

vi.mock('maplibre-gl', () => ({
  Map: MockMap,
  Marker: MockMarker,
  NavigationControl: MockNavigationControl
}));

const { uploadSelfieMock, checkInFnMock, checkOutFnMock, toastMock } = vi.hoisted(() => ({
  uploadSelfieMock: vi.fn(),
  checkInFnMock: vi.fn(),
  checkOutFnMock: vi.fn(),
  toastMock: { error: vi.fn() }
}));

vi.mock('@/lib/storage/upload-client', () => ({
  PHOTO_UPLOAD_FAILED: 'PHOTO_UPLOAD_FAILED',
  uploadSelfie: uploadSelfieMock
}));

vi.mock('sonner', () => ({
  toast: toastMock
}));

vi.mock('../api/service', () => ({
  checkInFn: checkInFnMock,
  checkOutFn: checkOutFnMock
}));

vi.mock('../api/queries', () => ({
  myAttendanceQueryOptions: () => ({
    queryKey: ['attendance', 'today'],
    queryFn: async () => ({ attendance: null })
  }),
  locationsQueryOptions: () => ({
    queryKey: ['attendance', 'locations'],
    queryFn: async () => ({ locations: [] })
  }),
  shiftsQueryOptions: () => ({
    queryKey: ['attendance', 'shifts'],
    queryFn: async () => ({ shifts: [] })
  })
}));

vi.mock('./location-map', () => ({
  LocationMap: () => <div data-testid='mock-location-map' />
}));

vi.mock('./selfie-capture', () => ({
  SelfieCapture: ({ onCapture }: { onCapture: (selfie: string) => void }) => (
    <button
      type='button'
      data-testid='capture-selfie'
      aria-label={'capture-selfie'}
      onClick={() => onCapture('data:image/jpeg;base64,xx')}
    />
  )
}));

function renderCard() {
  const queryClient = new QueryClient();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AttendanceCheckCard />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  uploadSelfieMock.mockReset();
  checkInFnMock.mockReset();
  checkOutFnMock.mockReset();
  toastMock.error.mockReset();
});

describe('clearSelfieAfterSuccess (checkout success handler)', () => {
  it('clears the checkout selfie and invalidates attendance queries on success', () => {
    const setCheckOutSelfie = vi.fn();
    const invalidate = vi.fn();

    const handled = clearSelfieAfterSuccess(
      { success: true, message: 'Check-out successful' },
      setCheckOutSelfie,
      invalidate
    );

    expect(handled).toBe(true);
    expect(setCheckOutSelfie).toHaveBeenCalledWith(null);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('leaves the captured selfie intact and skips invalidation on error response', () => {
    const setCheckOutSelfie = vi.fn();
    const invalidate = vi.fn();

    const handled = clearSelfieAfterSuccess(
      { success: false, code: 'NO_CHECK_IN', message: 'No check-in record found for today' },
      setCheckOutSelfie,
      invalidate
    );

    expect(handled).toBe(false);
    expect(setCheckOutSelfie).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('treats a null/undefined response as failure without clearing the selfie', () => {
    const setCheckOutSelfie = vi.fn();
    const invalidate = vi.fn();

    expect(clearSelfieAfterSuccess(null, setCheckOutSelfie, invalidate)).toBe(false);
    expect(setCheckOutSelfie).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('AttendanceCheckCard check-in with selfie upload', () => {
  it('shows only the upload-failed toast when the selfie upload fails', async () => {
    uploadSelfieMock.mockRejectedValue(new Error('PHOTO_UPLOAD_FAILED'));

    renderCard();

    fireEvent.click(screen.getByTestId('capture-selfie'));
    fireEvent.click(screen.getByRole('button', { name: 'Check In' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1));
    expect(toastMock.error).toHaveBeenCalledWith('Photo upload failed');
    expect(toastMock.error).not.toHaveBeenCalledWith(
      'Could not get your location. Check GPS permissions.'
    );
  });

  it('still shows the GPS toast when check-in fails for another reason', async () => {
    uploadSelfieMock.mockResolvedValue('attendance/u/1.jpg');
    checkInFnMock.mockRejectedValue(new Error('network down'));

    renderCard();

    fireEvent.click(screen.getByTestId('capture-selfie'));
    fireEvent.click(screen.getByRole('button', { name: 'Check In' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1));
    expect(toastMock.error).toHaveBeenCalledWith(
      'Could not get your location. Check GPS permissions.'
    );
  });
});
