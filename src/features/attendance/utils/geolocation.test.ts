// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentLocation } from './geolocation';

type GeoErrorCode = number;

function mockGeolocation(impl: {
  onSuccess?: boolean;
  stale?: boolean;
  inaccurate?: boolean;
  denied?: boolean;
  unavailable?: boolean;
  never?: boolean;
}) {
  const now = Date.now();
  const position = {
    coords: {
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: impl.inaccurate ? 500 : 10
    },
    timestamp: impl.stale ? now - 120_000 : now
  };

  const handlers: { success?: (p: unknown) => void; error?: (e: unknown) => void } = {};
  let lastOptions: unknown;

  const geolocation = {
    getCurrentPosition: vi.fn(
      (success?: (p: unknown) => void, error?: (e: unknown) => void, options?: unknown) => {
        lastOptions = options;
        if (impl.never) return;
        if (impl.onSuccess === false || impl.denied || impl.unavailable) {
          const code: GeoErrorCode = impl.denied ? 1 : 2;
          error?.({ code, PERMISSION_DENIED: 1, message: 'denied' });
          return;
        }
        handlers.success = success;
        handlers.error = error;
        success?.(position);
      }
    )
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: { geolocation },
    configurable: true
  });

  return { position, handlers, lastOptions: () => lastOptions };
}

function removeGeolocation() {
  // @ts-expect-error test cleanup
  delete globalThis.navigator;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  removeGeolocation();
  vi.restoreAllMocks();
});

describe('getCurrentLocation', () => {
  it('returns success with location when the browser provides a fresh accurate position', async () => {
    mockGeolocation({ onSuccess: true });
    const result = await getCurrentLocation();
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.location.latitude).toBe(-6.2088);
      expect(result.location.accuracy).toBe(10);
      expect(result.location.capturedAt).toBeTypeOf('number');
    }
  });

  it('returns permission-denied when the user blocks location access', async () => {
    mockGeolocation({ denied: true });
    const result = await getCurrentLocation();
    expect(result.status).toBe('permission-denied');
  });

  it('returns unavailable when geolocation API is missing', async () => {
    removeGeolocation();
    const result = await getCurrentLocation();
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on generic position errors', async () => {
    mockGeolocation({ unavailable: true });
    const result = await getCurrentLocation();
    expect(result.status).toBe('unavailable');
  });

  it('returns stale when the captured position is older than maxAgeMs', async () => {
    mockGeolocation({ stale: true });
    const result = await getCurrentLocation({ maxAgeMs: 30_000 });
    expect(result.status).toBe('stale');
    if (result.status === 'stale') {
      expect(result.location.latitude).toBe(-6.2088);
    }
  });

  it('returns inaccurate when accuracy exceeds the limit', async () => {
    mockGeolocation({ inaccurate: true });
    const result = await getCurrentLocation({ maxAccuracyMeters: 100 });
    expect(result.status).toBe('inaccurate');
  });

  it('times out when the browser never responds', async () => {
    mockGeolocation({ never: true });
    const promise = getCurrentLocation({ timeoutMs: 5_000 });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await promise;
    expect(result.status).toBe('timeout');
  });

  it('accepts an accurate position beyond the default stale limit when maxAgeMs is 0', async () => {
    mockGeolocation({ stale: true });
    const result = await getCurrentLocation({ maxAgeMs: 0 });
    expect(result.status).toBe('success');
  });

  it('uses enableHighAccuracy: true by default', async () => {
    const mock = mockGeolocation({ onSuccess: true });
    await getCurrentLocation();
    const options = mock.lastOptions() as { enableHighAccuracy?: boolean } | undefined;
    expect(options?.enableHighAccuracy).toBe(true);
  });

  it('passes enableHighAccuracy: false when highAccuracy option is false', async () => {
    const mock = mockGeolocation({ onSuccess: true });
    await getCurrentLocation({ highAccuracy: false });
    const options = mock.lastOptions() as { enableHighAccuracy?: boolean } | undefined;
    expect(options?.enableHighAccuracy).toBe(false);
  });

  it('returns success even with poor accuracy when accuracy gate is disabled (lenient mode)', async () => {
    mockGeolocation({ inaccurate: true });
    const result = await getCurrentLocation({ maxAccuracyMeters: 0 });
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.location.accuracy).toBe(500);
    }
  });
});
