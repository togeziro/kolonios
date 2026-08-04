import { isLocationStale, isAccuracyAcceptable } from './schedule';

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
};

export type LocationResult =
  | { status: 'success'; location: DeviceLocation }
  | { status: 'permission-denied' }
  | { status: 'unavailable' }
  | { status: 'stale'; location: DeviceLocation }
  | { status: 'inaccurate'; location: DeviceLocation }
  | { status: 'timeout' };

export interface GetCurrentLocationOptions {
  timeoutMs?: number;
  maxAgeMs?: number;
  maxAccuracyMeters?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_AGE_MS = 30_000;
const DEFAULT_MAX_ACCURACY_METERS = 100;

/**
 * One-shot browser location fetch. Returns a discriminated result instead of
 * throwing, so the UI can show the exact GPS state to the employee. Pure
 * staleness/accuracy checks reuse the schedule domain helpers.
 */
export function getCurrentLocation(
  options: GetCurrentLocationOptions = {}
): Promise<LocationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const maxAccuracyMeters = options.maxAccuracyMeters ?? DEFAULT_MAX_ACCURACY_METERS;

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ status: 'unavailable' });
      return;
    }

    let settled = false;
    const settle = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => settle({ status: 'timeout' }), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        const location: DeviceLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: position.timestamp ?? Date.now()
        };

        const now = Date.now();
        if (isLocationStale(location.capturedAt, now, maxAgeMs)) {
          settle({ status: 'stale', location });
          return;
        }
        if (!isAccuracyAcceptable(location.accuracy, maxAccuracyMeters)) {
          settle({ status: 'inaccurate', location });
          return;
        }
        settle({ status: 'success', location });
      },
      (error) => {
        clearTimeout(timer);
        if (error.code === error.PERMISSION_DENIED) {
          settle({ status: 'permission-denied' });
        } else {
          settle({ status: 'unavailable' });
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}
