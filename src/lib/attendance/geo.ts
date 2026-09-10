/**
 * Pure geo-fencing for attendance check-in/out. All functions are pure:
 * explicit inputs, no globals, no Date.now(), no DB, no browser APIs. The
 * caller loads the office location and supplies the clock; this module only
 * decides whether a submitted position is acceptable.
 */

import {
  calculateDistance,
  isLocationStale,
  isAccuracyAcceptable,
  type AttendancePolicy
} from './schedule';

/**
 * The minimal shape of an office location this module needs. A Drizzle
 * `locations` row is structurally assignable to it, so the pure layer stays
 * ignorant of the DB schema.
 */
export type GeofenceLocation = {
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
};

export type GpsValidationInput = {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: number;
  locationId?: number | null;
  policy: AttendancePolicy;
  /** The office location the check-in is validated against, loaded by the caller. */
  location: GeofenceLocation | null;
  /** Injected clock (ms since epoch) for the staleness check. */
  now: number;
};

export type GpsValidationResult =
  | { ok: true; distanceToOffice: number }
  | { ok: false; code: string; message: string };

export function validateGpsLocation(input: GpsValidationInput): GpsValidationResult {
  const { latitude, longitude, accuracy, capturedAt, locationId, policy, location, now } = input;
  // When GPS validation is enabled every coordinate field is required;
  // omitting any of them must not bypass validation.
  if (
    latitude == null ||
    longitude == null ||
    accuracy == null ||
    capturedAt == null ||
    locationId == null
  ) {
    return { ok: false, code: 'GPS_REQUIRED', message: 'GPS location is required' };
  }
  // Reject stale coordinates (server-side, never trust the client)
  if (isLocationStale(capturedAt, now, policy.maxStaleMs)) {
    return {
      ok: false,
      code: 'GPS_STALE',
      message: 'Location is stale. Refresh your location and try again.'
    };
  }
  // Reject inaccurate coordinates
  if (!isAccuracyAcceptable(accuracy, policy.maxAccuracyMeters)) {
    return {
      ok: false,
      code: 'GPS_INACCURATE',
      message: 'GPS accuracy is too low. Move to an open area and refresh.'
    };
  }
  // Validate geofence against the submitted location
  if (!location || location.latitude == null || location.longitude == null) {
    return { ok: false, code: 'GPS_REQUIRED', message: 'Location not found' };
  }

  const distanceToOffice = calculateDistance(
    latitude,
    longitude,
    location.latitude,
    location.longitude
  );

  if (location.radius != null && distanceToOffice > location.radius) {
    return {
      ok: false,
      code: 'OUTSIDE_RADIUS',
      message: `You are ${Math.round(distanceToOffice)}m from the office. Must be within ${location.radius}m.`
    };
  }

  return { ok: true, distanceToOffice };
}
