import { describe, expect, it } from 'vitest';
import { validateGpsLocation, type GeofenceLocation } from './geo';
import type { AttendancePolicy } from './schedule';

const policy: AttendancePolicy = {
  gpsValidationEnabled: true,
  selfieRequired: false,
  maxAccuracyMeters: 50,
  maxStaleMs: 30_000
};

// Fixed clock so staleness is deterministic (no Date.now()).
const NOW = 1_700_000_000_000;

const office: GeofenceLocation = { latitude: -6.2, longitude: 106.85, radius: 500 };

describe('validateGpsLocation (pure)', () => {
  it('rejects when any coordinate field is missing', () => {
    const res = validateGpsLocation({
      latitude: -6.2,
      longitude: 106.85,
      accuracy: 10,
      // capturedAt omitted
      locationId: 1,
      policy,
      location: office,
      now: NOW
    });
    if (res.ok) throw new Error('expected failure');
    expect(res.code).toBe('GPS_REQUIRED');
    expect(res.message).toBe('GPS location is required');
  });

  it('rejects when the office location was not found', () => {
    const res = validateGpsLocation({
      latitude: -6.2,
      longitude: 106.85,
      accuracy: 10,
      capturedAt: NOW,
      locationId: 1,
      policy,
      location: null,
      now: NOW
    });
    if (res.ok) throw new Error('expected failure');
    expect(res.code).toBe('GPS_REQUIRED');
    expect(res.message).toBe('Location not found');
  });

  it('rejects stale coordinates', () => {
    const res = validateGpsLocation({
      latitude: -6.2,
      longitude: 106.85,
      accuracy: 10,
      capturedAt: NOW - 120_000,
      locationId: 1,
      policy,
      location: office,
      now: NOW
    });
    if (res.ok) throw new Error('expected failure');
    expect(res.code).toBe('GPS_STALE');
  });

  it('rejects low-accuracy coordinates', () => {
    const res = validateGpsLocation({
      latitude: -6.2,
      longitude: 106.85,
      accuracy: 500,
      capturedAt: NOW,
      locationId: 1,
      policy,
      location: office,
      now: NOW
    });
    if (res.ok) throw new Error('expected failure');
    expect(res.code).toBe('GPS_INACCURATE');
  });

  it('rejects positions outside the geofence radius', () => {
    const res = validateGpsLocation({
      latitude: -7.0, // ~89 km south of the office
      longitude: 106.85,
      accuracy: 10,
      capturedAt: NOW,
      locationId: 1,
      policy,
      location: { latitude: -6.2, longitude: 106.85, radius: 50 },
      now: NOW
    });
    if (res.ok) throw new Error('expected failure');
    expect(res.code).toBe('OUTSIDE_RADIUS');
  });

  it('returns the distance when the position is valid', () => {
    const res = validateGpsLocation({
      latitude: -6.2,
      longitude: 106.85,
      accuracy: 10,
      capturedAt: NOW,
      locationId: 1,
      policy,
      location: office,
      now: NOW
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.distanceToOffice).toBe(0);
  });
});
