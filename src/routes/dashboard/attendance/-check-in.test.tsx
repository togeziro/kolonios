// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { CheckInPage } from '@/features/attendance/components/check-in-page';

// CheckInScan pulls in FaceCapture (WebGL/human.js) — stub it with a button
// that drives onCheckIn directly, the same way a successful scan would.
// The stub keeps the picker + enrollment-gate contract surface (selection
// buttons, guard hint, gate link, face error) so page-level tests can assert
// the ticket-01 wiring without the real camera stack.
// The page stub keeps the check-in contract surface (faceError, gate link,
// location guard) and now also the checkout path: onCheckOut receives the
// checkout selfie captured in the scan card.
vi.mock('@/features/attendance/components/check-in-scan', () => ({
  CheckInScan: ({
    onCheckIn,
    onCheckOut,
    locations,
    shifts,
    selectedLocationId,
    selectedShiftId,
    onSelectLocation,
    onSelectShift,
    noLocationSelected,
    faceError,
    faceEnrolled,
    faceEnrollmentPending,
    isCheckedIn
  }: {
    onCheckIn: (
      descriptor: number[],
      photo: string,
      antiSpoofScore: number | null,
      livenessScore: number | null
    ) => void;
    onCheckOut: (photo: string | null) => void;
    locations: { id: number; name: string }[];
    shifts: { id: number; name: string }[];
    selectedLocationId: number | null;
    selectedShiftId: number | null;
    onSelectLocation: (id: number) => void;
    onSelectShift: (id: number) => void;
    noLocationSelected: boolean;
    faceError: string | null;
    faceEnrolled: boolean;
    faceEnrollmentPending: boolean;
    isCheckedIn: boolean;
  }) => (
    <div>
      <div data-testid='check-in-locations'>
        {locations.map((l) => (
          <button
            key={l.id}
            type='button'
            data-testid={`location-${l.id}`}
            data-selected={selectedLocationId === l.id}
            onClick={() => onSelectLocation(l.id)}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div data-testid='check-in-shifts'>
        {shifts.map((s) => (
          <button
            key={s.id}
            type='button'
            data-testid={`shift-${s.id}`}
            data-selected={selectedShiftId === s.id}
            onClick={() => onSelectShift(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      {noLocationSelected && <p data-testid='no-location-hint'>{'select-location-first'}</p>}
      {faceError && <p data-testid='face-error'>{faceError}</p>}
      {!faceEnrollmentPending && !faceEnrolled && (
        <a data-testid='enrollment-gate-link' href='/dashboard/attendance/face-settings'>
          {'enroll'}
        </a>
      )}
      <button
        type='button'
        data-testid='check-in-trigger'
        aria-label={'trigger-check-in'}
        onClick={() => onCheckIn([0.1, 0.2, 0.3], 'data:image/jpeg;base64,xx', 0.9, 0.9)}
      />
      {isCheckedIn && (
        <button
          type='button'
          data-testid='check-out-trigger'
          aria-label={'trigger-check-out'}
          onClick={() => onCheckOut('data:image/jpeg;base64,checkout')}
        />
      )}
    </div>
  )
}));

vi.mock('@/features/attendance/components/check-in-success', () => ({
  CheckInSuccess: () => <div data-testid='check-in-success' />
}));

// History + correction sections render in the single flow, but their server
// queries are out of scope here — stub them so page tests focus on the
// checkout mutation wiring (contract: owner+date+id, lock_location policy,
// GPS+selfie via checkOutFn).
vi.mock('@/features/attendance/components/attendance-history', () => ({
  default: () => <div data-testid='attendance-history-section' />
}));

vi.mock('@/features/attendance/components/attendance-correction-form', () => ({
  AttendanceCorrectionForm: ({ attendanceId }: { attendanceId: number }) => (
    <div data-testid='attendance-correction-section' data-attendance-id={attendanceId} />
  )
}));

const {
  getCurrentLocationMock,
  uploadSelfieMock,
  checkInFnMock,
  checkOutFnMock,
  verifyFaceFnMock,
  toastMock
} = vi.hoisted(() => ({
  getCurrentLocationMock: vi.fn(),
  uploadSelfieMock: vi.fn(),
  checkInFnMock: vi.fn(),
  checkOutFnMock: vi.fn(),
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
  checkInFn: checkInFnMock,
  checkOutFn: checkOutFnMock
}));

vi.mock('@/features/face/api/service', () => ({
  verifyFaceFn: verifyFaceFnMock
}));

vi.mock('@/features/attendance/api/queries', () => ({
  myAttendanceQueryOptions: () => ({
    queryKey: ['attendance', 'today'],
    queryFn: async () => ({ attendance: attendanceState.value })
  }),
  locationsQueryOptions: () => ({
    queryKey: ['attendance', 'locations'],
    queryFn: async () => ({
      locations: [
        { id: 7, name: 'HQ', latitude: -6.2, longitude: 106.8, radius: 100 },
        { id: 9, name: 'Branch', latitude: -6.3, longitude: 106.9, radius: 100 }
      ]
    })
  }),
  shiftsQueryOptions: () => ({
    queryKey: ['attendance', 'shifts'],
    queryFn: async () => ({
      shifts: [{ id: 3, name: 'Morning', start_time: '08:00', end_time: '17:00' }]
    })
  })
}));

const ENROLLED_STATE = { enrolled: true, count: 1, registeredAt: null };
let enrollmentState = ENROLLED_STATE;

// Checked-in record state for the checkout flow: the page derives
// attendanceId + isCheckedIn from myAttendanceQueryOptions.
const attendanceState: {
  value: {
    attendance: { id: number; check_in_time: string; check_out_time: string | null };
  } | null;
} = { value: null };

vi.mock('@/features/face/api/queries', () => ({
  myFaceEnrollmentQueryOptions: () => ({
    queryKey: ['face', 'enrollment'],
    queryFn: async () => enrollmentState
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
  enrollmentState = ENROLLED_STATE;
  attendanceState.value = null;
  getCurrentLocationMock
    .mockReset()
    .mockResolvedValue({ status: 'success', location: DEVICE_LOCATION });
  uploadSelfieMock.mockReset().mockResolvedValue('attendance/u/1.jpg');
  checkInFnMock.mockReset().mockResolvedValue({ success: true });
  checkOutFnMock.mockReset().mockResolvedValue({ success: true });
  verifyFaceFnMock.mockReset().mockResolvedValue({ verified: true, reason: 'MATCH' });
  toastMock.error.mockReset();
});

describe('CheckInPage two-step check-in flow', () => {
  it('sends GPS coordinates incl. capturedAt from the device fix to checkInFn (regression)', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('location-7'));
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
    fireEvent.click(await screen.findByTestId('location-7'));
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
    fireEvent.click(await screen.findByTestId('location-7'));
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
    fireEvent.click(await screen.findByTestId('location-7'));
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
    fireEvent.click(await screen.findByTestId('location-7'));
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
    fireEvent.click(await screen.findByTestId('location-7'));
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
    fireEvent.click(await screen.findByTestId('location-7'));
    triggerCheckIn();

    await waitFor(() => expect(screen.getByTestId('check-in-success')).toBeTruthy());
  });
});

describe('CheckInPage location + shift picker and enrollment gate (ticket 01)', () => {
  it('blocks the submit with an inline hint when no location is selected', async () => {
    renderPage();
    // Two locations configured → nothing preselected.
    await screen.findByTestId('location-7');
    expect(screen.queryByTestId('no-location-hint')).toBeNull();

    triggerCheckIn();

    await screen.findByTestId('no-location-hint');
    expect(verifyFaceFnMock).not.toHaveBeenCalled();
    expect(getCurrentLocationMock).not.toHaveBeenCalled();
    expect(uploadSelfieMock).not.toHaveBeenCalled();
    expect(checkInFnMock).not.toHaveBeenCalled();
    // Inline hint, not a toast.
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('clears the guard and submits the chosen location once the technician picks one', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('location-9'));
    triggerCheckIn();

    await waitFor(() =>
      expect(checkInFnMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ locationId: 9 })
      })
    );
    expect(screen.queryByTestId('no-location-hint')).toBeNull();
  });

  it('submits the default first shift when the technician picks only a location', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('location-7'));
    triggerCheckIn();

    await waitFor(() =>
      expect(checkInFnMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ locationId: 7, shiftId: 3 })
      })
    );
  });

  it('switches the submitted shift when the technician taps another shift', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('location-7'));
    fireEvent.click(await screen.findByTestId('shift-3'));
    expect(screen.getByTestId('shift-3').getAttribute('data-selected')).toBe('true');
    triggerCheckIn();

    await waitFor(() =>
      expect(checkInFnMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ locationId: 7, shiftId: 3 })
      })
    );
  });

  it('renders the enrollment gate link when the user is not enrolled', async () => {
    enrollmentState = { enrolled: false, count: 0, registeredAt: null };
    renderPage();

    const link = await screen.findByTestId('enrollment-gate-link');
    expect(link.getAttribute('href')).toBe('/dashboard/attendance/face-settings');
  });

  it('renders the NOT_ENROLLED error instead of swallowing it', async () => {
    verifyFaceFnMock.mockResolvedValue({ verified: false, reason: 'NOT_ENROLLED' });
    renderPage();
    fireEvent.click(await screen.findByTestId('location-7'));
    triggerCheckIn();

    await screen.findByTestId('face-error');
    expect(screen.getByTestId('face-error').textContent).toMatch(/enroll/i);
    expect(checkInFnMock).not.toHaveBeenCalled();
    expect(uploadSelfieMock).not.toHaveBeenCalled();
  });

  it('still requires face-match on normal locations: NO_MATCH never reaches GPS/upload/save', async () => {
    verifyFaceFnMock.mockResolvedValue({ verified: false, reason: 'NO_MATCH' });
    renderPage();
    fireEvent.click(await screen.findByTestId('location-7'));
    triggerCheckIn();

    await screen.findByTestId('face-error');
    expect(verifyFaceFnMock).toHaveBeenCalledTimes(1);
    expect(getCurrentLocationMock).not.toHaveBeenCalled();
    expect(uploadSelfieMock).not.toHaveBeenCalled();
    expect(checkInFnMock).not.toHaveBeenCalled();
  });
});

describe('CheckInPage checkout + history/correction sections (ticket 03)', () => {
  function setCheckedIn() {
    attendanceState.value = {
      attendance: { id: 41, check_in_time: '07:43:56', check_out_time: null }
    };
  }

  it('sends attendanceId + GPS fix + uploaded selfie photo to checkOutFn', async () => {
    setCheckedIn();
    renderPage();

    fireEvent.click(await screen.findByTestId('check-out-trigger'));

    await waitFor(() => expect(checkOutFnMock).toHaveBeenCalledTimes(1));
    expect(checkOutFnMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attendanceId: 41,
        latitude: DEVICE_LOCATION.latitude,
        longitude: DEVICE_LOCATION.longitude,
        accuracy: DEVICE_LOCATION.accuracy,
        capturedAt: DEVICE_LOCATION.capturedAt,
        photo: 'attendance/u/1.jpg'
      })
    });
    // GPS acquired before the upload, like check-in.
    expect(getCurrentLocationMock.mock.invocationCallOrder[0]).toBeLessThan(
      uploadSelfieMock.mock.invocationCallOrder[0]
    );
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('maps OUTSIDE_RADIUS to the localized toast (checkout from the wrong fence)', async () => {
    checkOutFnMock.mockResolvedValue({
      success: false,
      code: 'OUTSIDE_RADIUS',
      message: 'You are far away'
    });
    setCheckedIn();
    renderPage();

    fireEvent.click(await screen.findByTestId('check-out-trigger'));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        'You are outside the geofence radius. Move closer to the office and refresh your location.'
      )
    );
    expect(toastMock.error).not.toHaveBeenCalledWith('You are far away');
  });

  it('aborts checkout before any upload when GPS is unavailable', async () => {
    getCurrentLocationMock.mockResolvedValue({ status: 'permission-denied' });
    setCheckedIn();
    renderPage();

    fireEvent.click(await screen.findByTestId('check-out-trigger'));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        'Could not get your location. Check GPS permissions.'
      )
    );
    expect(uploadSelfieMock).not.toHaveBeenCalled();
    expect(checkOutFnMock).not.toHaveBeenCalled();
  });

  it('aborts checkout when the selfie upload fails (PHOTO_UPLOAD_FAILED)', async () => {
    uploadSelfieMock.mockRejectedValue(new Error('PHOTO_UPLOAD_FAILED'));
    setCheckedIn();
    renderPage();

    fireEvent.click(await screen.findByTestId('check-out-trigger'));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Photo upload failed'));
    expect(checkOutFnMock).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledTimes(1);
  });

  it('renders the history section on the single page', async () => {
    renderPage();

    expect(await screen.findByTestId('attendance-history-section')).toBeTruthy();
  });

  it('renders the correction form wired to today\u2019s record once checked in', async () => {
    setCheckedIn();
    renderPage();

    const section = await screen.findByTestId('attendance-correction-section');
    expect(section.getAttribute('data-attendance-id')).toBe('41');
  });

  it('hides the correction form when there is no record today', async () => {
    renderPage();
    await screen.findByTestId('attendance-history-section');

    expect(screen.queryByTestId('attendance-correction-section')).toBeNull();
  });
});
