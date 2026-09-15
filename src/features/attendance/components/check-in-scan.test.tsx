// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { CheckInScan } from './check-in-scan';

// FaceCapture pulls in WebGL/human.js — stub it: enrolled users get a capture
// button, matching the onCheckIn contract.
vi.mock('./face-capture', () => ({
  FaceCapture: ({ onCapture }: { onCapture: (...args: unknown[]) => void }) => (
    <button
      type='button'
      data-testid='face-capture'
      onClick={() => onCapture([], 'photo', 0.9, 0.9)}
    >
      {'face-capture'}
    </button>
  )
}));

// LocationMap pulls in maplibre — stub it out.
vi.mock('./location-map', () => ({
  LocationMap: () => <div data-testid='location-map' />
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a data-testid='enrollment-link' href={to}>
      {children}
    </a>
  )
}));

const LOCATIONS = [
  { id: 7, name: 'HQ', latitude: -6.2, longitude: 106.8, radius: 100 },
  { id: 9, name: 'Branch', latitude: -6.3, longitude: 106.9, radius: 100 }
];
const SHIFTS = [
  { id: 3, name: 'Morning', start_time: '08:00', end_time: '17:00' },
  { id: 4, name: 'Night', start_time: '20:00', end_time: '05:00' }
];

function renderScan(overrides: Partial<Parameters<typeof CheckInScan>[0]> = {}) {
  const props: Parameters<typeof CheckInScan>[0] = {
    locations: LOCATIONS,
    shifts: SHIFTS,
    selectedLocationId: null,
    selectedShiftId: null,
    onSelectLocation: vi.fn(),
    onSelectShift: vi.fn(),
    location: null,
    shift: null,
    noLocationSelected: false,
    faceError: null,
    isCheckedIn: false,
    accuracyLevel: 'medium',
    faceEnrolled: true,
    onCheckIn: vi.fn(),
    onCheckOut: vi.fn(),
    ...overrides
  };
  render(
    <I18nextProvider i18n={i18n}>
      <CheckInScan {...props} />
    </I18nextProvider>
  );
  return props;
}

describe('CheckInScan location + shift picker', () => {
  it('renders one button per location and per shift', () => {
    renderScan();
    expect(screen.getByRole('button', { name: /HQ/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Branch/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Morning/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Night/ })).toBeTruthy();
  });

  it('calls onSelectLocation with the tapped location id', () => {
    const props = renderScan();
    fireEvent.click(screen.getByRole('button', { name: /Branch/ }));
    expect(props.onSelectLocation).toHaveBeenCalledWith(9);
  });

  it('calls onSelectShift with the tapped shift id', () => {
    const props = renderScan();
    fireEvent.click(screen.getByRole('button', { name: /Night/ }));
    expect(props.onSelectShift).toHaveBeenCalledWith(4);
  });

  it('shows the select-location-first hint only when the guard fires', () => {
    const { unmount } = render(
      <I18nextProvider i18n={i18n}>
        <CheckInScan
          locations={LOCATIONS}
          shifts={SHIFTS}
          selectedLocationId={null}
          selectedShiftId={null}
          onSelectLocation={vi.fn()}
          onSelectShift={vi.fn()}
          location={null}
          shift={null}
          noLocationSelected={false}
          faceError={null}
          isCheckedIn={false}
          accuracyLevel={'medium'}
          faceEnrolled
          onCheckIn={vi.fn()}
          onCheckOut={vi.fn()}
        />
      </I18nextProvider>
    );
    expect(screen.queryByText(/Select your work location first/i)).toBeNull();
    unmount();
    renderScan({ noLocationSelected: true });
    expect(screen.getByText(/Select your work location first/i)).toBeTruthy();
  });
});

describe('CheckInScan enrollment gate', () => {
  it('replaces the camera with an enrollment link when not enrolled', () => {
    renderScan({ faceEnrolled: false, faceEnrollmentPending: false });
    expect(screen.queryByTestId('face-capture')).toBeNull();
    const link = screen.getByTestId('enrollment-link');
    expect(link.getAttribute('href')).toBe('/dashboard/attendance/face-settings');
  });

  it('keeps the camera while the enrollment status is still loading', () => {
    renderScan({ faceEnrolled: false, faceEnrollmentPending: true });
    expect(screen.getByTestId('face-capture')).toBeTruthy();
    expect(screen.queryByTestId('enrollment-link')).toBeNull();
  });

  it('shows the camera for enrolled users with no gate link', () => {
    renderScan({ faceEnrolled: true });
    expect(screen.getByTestId('face-capture')).toBeTruthy();
    expect(screen.queryByTestId('enrollment-link')).toBeNull();
  });

  it('renders the face error text (NOT_ENROLLED / NO_MATCH) instead of swallowing it', () => {
    renderScan({ faceError: 'You have not enrolled your face yet.' });
    expect(screen.getByText('You have not enrolled your face yet.')).toBeTruthy();
  });
});
