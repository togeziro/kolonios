import type { LineString } from 'geojson';

export type MapCoordinates = { lat: number; lng: number };

/**
 * Reject fixes the browser shouldn't have returned: NaN, out-of-range, or the
 * common headless/permission-denied fallback of (0,0). Used both by the
 * `geolocate` event handler and the `syncMarkers` guard so the map never
 * draws a phantom marker or fits the world to a zero coordinate.
 */
export function isPlausibleFix(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  // (0,0) is the "Null Island" sentinel, never a real user fix.
  if (Math.abs(latitude) < 0.5 && Math.abs(longitude) < 0.5) return false;
  return true;
}

export function routeLine(device: MapCoordinates, destination: MapCoordinates): LineString {
  return {
    type: 'LineString',
    coordinates: [
      [device.lng, device.lat],
      [destination.lng, destination.lat]
    ]
  };
}

export function emptyLine(): LineString {
  return { type: 'LineString', coordinates: [] };
}
