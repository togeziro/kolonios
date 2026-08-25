// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { CheckInPage } from '@/features/attendance/components/check-in-page';

// CheckInScan pulls in FaceCapture (WebGL/human.js) — stub it with a button
// that drives onCheckIn directly, the same way a successful scan would.
vi.mock('@/features/attendance/components/check-in-scan', () => ({
  CheckInScan: ({
    onCheckIn
  }: {
    onCheckIn: (
      descriptor: number[],
      photo: string,
      antiSpoofScore: number | null,
      livenessScore: number | null
    ) => void;
  }) => (
    <button
      type='button'
      data-testid='check-in-trigger'
      aria-label={'trigger-check-in'}
      onClick={() => onCheckIn([0.1, 0.2, 0.3], 'data:image/jpeg;base64,xx', 0.9, 0.9)}
    />
  )
}));

vi.mock('@/features/attendance/components/check-in-success', () => ({
  CheckInSuccess: () => <div data-testid='check-in-success' />
}));

const { getCurrentLocationMock, uploadSelfieMock, checkInFnMock, verifyFaceFnMock, toastMock } =
  vi.hoisted(() => ({
    getCurrentLocationMock: vi.fn(),
    uploadSelfieMock: vi.fn(),
    checkInFnMock: vi.fn(),
    verifyFaceFnMock: vi.fn(),
    toastMock: { error: vi.fn() }
  }));

vi.mock('@/features/attendance/utils/geolocation', () => ({
  getCurrentLocation: getCurrentLocationMock
}));

vi.mock('@/lib/storage/upload-client', () => ({
  PHOTO_UPLOAD_FAILED: 'PHOTO_UPLOAD_FAILED',
  uploadSelfie: uploadSelfieMock
}));

vi.mock('sonner', () => ({
  toast: toastMock
}));

vi.mock('@/features/attendance/api/service', () => ({
  checkInFn: checkInFnMock
}));

vi.mock('@/features/face/api/service', () => ({
  verifyFaceFn: verifyFaceFnMock
}));

vi.mock('@/features/attendance/api/queries', () => ({
  myAttendanceQueryOptions: () => ({
    queryKey: ['attendance', 'today'],
    queryFn: async () => ({ attendance: null })
  }),
  locationsQueryOptions: () => ({
    queryKey: ['attendance', 'locations'],
    queryFn: async () => ({
      locations: [{ id: 7, name: 'HQ', latitude: -6.2, longitude: 106.8, radius: 100 }]
    })
  }),
  shiftsQueryOptions: () => ({
    queryKey: ['attendance', 'shifts'],
    queryFn: async () => ({
      shifts: [{ id: 3, name: 'Morning', start_time: '08:00', end_time: '17:00' }]
    })
  })
}));

vi.mock('@/features/face/api/queries', () => ({
  myFaceEnrollmentQueryOptions: () => ({
    queryKey: ['face', 'enrollment'],
    queryFn: async () => ({ enrolled: true, count: 1, registeredAt: null })
  }),
  faceSettingsQueryOptions: () => ({
    queryKey: ['face', 'settings'],
    queryFn: async () => ({
      validationMode: 'background',
      accuracyLevel: 'medium',
      showSeconds: false
    })
  })
}));

const DEVICE_LOCATION = {
  latitude: -6.2,
  longitude: 106.816666,
  accuracy: 12,
  capturedAt: 1756200000000
};

function renderPage() {
  const queryClient = new QueryClient();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <CheckInPage />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function triggerCheckIn() {
  fireEvent.click(screen.getByTestId('check-in-trigger'));
}

beforeEach(() => {
  getCurrentLocationMock
    .mockReset()
    .mockResolvedValue({ status: 'success', location: DEVICE_LOCATION });
  uploadSelfieMock.mockReset().mockResolvedValue('attendance/u/1.jpg');
  checkInFnMock.mockReset().mockResolvedValue({ success: true });
  verifyFaceFnMock.mockReset().mockResolvedValue({ verified: true, reason: 'MATCH' });
  toastMock.error.mockReset();
});

describe('CheckInPage two-step check-in flow', () => {
  it('sends GPS coordinates incl. capturedAt from the device fix to checkInFn (regression)', async () => {
    renderPage();
    triggerCheckIn();

    await waitFor(() =>
      expect(checkInFnMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          latitude: DEVICE_LOCATION.latitude,
          longitude: DEVICE_LOCATION.longitude,
          accuracy: DEVICE_LOCATION.accuracy,
          capturedAt: DEVICE_LOCATION.capturedAt,
          photo: 'attendance/u/1.jpg'
        })
      })
    );
  });

  it('fetches GPS before uploading the selfie', async () => {
    renderPage();
    triggerCheckIn();

    await waitFor(() => expect(checkInFnMock).toHaveBeenCalled());
    expect(getCurrentLocationMock.mock.invocationCallOrder[0]).toBeLessThan(
      uploadSelfieMock.mock.invocationCallOrder[0]
    );
  });

  it('still submits stale fixes and lets the server decide via capturedAt', async () => {
    getCurrentLocationMock.mockResolvedValue({
      status: 'stale',
      location: DEVICE_LOCATION
    });
    renderPage();
    triggerCheckIn();

    await waitFor(() =>
      expect(checkInFnMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          latitude: DEVICE_LOCATION.latitude,
          capturedAt: DEVICE_LOCATION.capturedAt
        })
      })
    );
  });

  it('aborts before any upload when GPS permission is denied, with a specific toast', async () => {
    getCurrentLocationMock.mockResolvedValue({ status: 'permission-denied' });
    renderPage();
    triggerCheckIn();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        'Could not get your location. Check GPS permissions.'
      )
    );
    expect(uploadSelfieMock).not.toHaveBeenCalled();
    expect(checkInFnMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalledWith('Check-in failed');
  });

  it('aborts before checkInFn when the selfie upload fails (PHOTO_UPLOAD_FAILED)', async () => {
    uploadSelfieMock.mockRejectedValue(new Error('PHOTO_UPLOAD_FAILED'));
    renderPage();
    triggerCheckIn();

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Photo upload failed'));
    expect(checkInFnMock).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledTimes(1);
  });

  it('maps server business codes to localized toasts (OUTSIDE_RADIUS)', async () => {
    checkInFnMock.mockResolvedValue({
      success: false,
      code: 'OUTSIDE_RADIUS',
      message: 'You are outside the fence'
    });
    renderPage();
    triggerCheckIn();

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        'You are outside the geofence radius. Move closer to the office and refresh your location.'
      )
    );
    expect(toastMock.error).not.toHaveBeenCalledWith('You are outside the fence');
  });

  it('moves to the success step when the server accepts the check-in', async () => {
    renderPage();
    triggerCheckIn();

    await waitFor(() => expect(screen.getByTestId('check-in-success')).toBeTruthy());
  });
});
