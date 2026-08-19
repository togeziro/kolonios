import { describe, expect, it } from 'vitest';
import { emptyLine, isPlausibleFix, routeLine } from './route-map.utils';

describe('isPlausibleFix', () => {
  it('accepts a normal Jakarta fix', () => {
    expect(isPlausibleFix(-6.2088, 106.8456)).toBe(true);
  });

  it('rejects (0,0) — the headless Null Island fallback', () => {
    expect(isPlausibleFix(0, 0)).toBe(false);
  });

  it('rejects very small near-zero coordinates', () => {
    expect(isPlausibleFix(0.1, 0.1)).toBe(false);
    expect(isPlausibleFix(-0.4, -0.4)).toBe(false);
  });

  it('rejects NaN and Infinity', () => {
    expect(isPlausibleFix(NaN, 100)).toBe(false);
    expect(isPlausibleFix(10, NaN)).toBe(false);
    expect(isPlausibleFix(Infinity, 0)).toBe(false);
  });

  it('rejects out-of-range latitude/longitude', () => {
    expect(isPlausibleFix(91, 100)).toBe(false);
    expect(isPlausibleFix(-91, 100)).toBe(false);
    expect(isPlausibleFix(10, 181)).toBe(false);
    expect(isPlausibleFix(10, -181)).toBe(false);
  });
});

describe('routeLine', () => {
  it('builds a LineString between device and destination in [lng, lat] order', () => {
    const geom = routeLine({ lat: -6.21, lng: 106.84 }, { lat: -6.86, lng: 107.57 });
    expect(geom).toEqual({
      type: 'LineString',
      coordinates: [
        [106.84, -6.21],
        [107.57, -6.86]
      ]
    });
  });
});

describe('emptyLine', () => {
  it('returns a LineString with no coordinates', () => {
    expect(emptyLine()).toEqual({ type: 'LineString', coordinates: [] });
  });
});
