// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { clearSelfieAfterSuccess } from './attendance-check-card';

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
