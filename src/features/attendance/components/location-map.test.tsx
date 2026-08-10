// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LocationMap } from './location-map';

const clickHandlers: Record<string, ((e: unknown) => void) | undefined> = {};
const markerHandlers: Record<string, (() => void) | undefined> = {};
const geolocateHandlers: Record<string, ((e: unknown) => void) | undefined> = {};

class FakeMarker {
  draggable: boolean;
  color?: string;
  on = vi.fn((event: string, cb: () => void) => {
    markerHandlers[event] = cb;
    return this;
  });
  setLngLat = vi.fn(() => this);
  addTo = vi.fn(() => this);
  getLngLat = vi.fn(() => ({ lat: -6.2, lng: 106.85 }));
  constructor(opts: { draggable?: boolean; color?: string } = {}) {
    this.draggable = opts.draggable ?? false;
    this.color = opts.color;
  }
}

class FakeMap {
  on = vi.fn((event: string, cb: (e: unknown) => void) => {
    clickHandlers[event] = cb;
    return this;
  });
  addControl = vi.fn();
  addSource = vi.fn();
  addLayer = vi.fn((layer: { id: string }) => {
    layerIds.push(layer.id);
  });
  getSource = vi.fn(() => ({ setData: vi.fn() }));
  remove = vi.fn();
}

class FakeNavigationControl {
  render = vi.fn();
}

class FakeGeolocateControl {
  static instances = 0;
  constructor() {
    FakeGeolocateControl.instances += 1;
  }
  on = vi.fn((event: string, cb: (e: unknown) => void) => {
    geolocateHandlers[event] = cb;
    return this;
  });
  trigger = vi.fn();
}

const geolocationMock = vi.fn();

function setGeoSupported(supported: boolean) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    writable: true,
    value: supported ? { getCurrentPosition: geolocationMock } : undefined
  });
}

const layerIds: string[] = [];

vi.mock('maplibre-gl', () => ({
  Map: FakeMap,
  Marker: FakeMarker,
  NavigationControl: FakeNavigationControl,
  GeolocateControl: FakeGeolocateControl
}));

beforeEach(() => {
  clickHandlers['click'] = undefined;
  markerHandlers['dragend'] = undefined;
  geolocateHandlers['geolocate'] = undefined;
  layerIds.length = 0;
  FakeGeolocateControl.instances = 0;
  geolocationMock.mockReset();
  setGeoSupported(true);
});

describe('LocationMap', () => {
  it('renders a map container', async () => {
    render(<LocationMap coordinates={null} radius={100} />);
    await act(async () => {});
    expect(screen.getByTestId('attendance-map')).toBeTruthy();
  });

  it('emits coordinates when the map is clicked', async () => {
    let result: { lat: number; lng: number } | null = null;
    render(
      <LocationMap
        coordinates={{ lat: -6.2, lng: 106.85 }}
        radius={100}
        onChange={(c) => (result = c)}
      />
    );
    await act(async () => {});
    await act(async () => {
      clickHandlers['click']?.({ lngLat: { lat: -6.5, lng: 106.9 } });
    });
    expect(result).toEqual({ lat: -6.5, lng: 106.9 });
  });

  it('does not register a click handler in read-only mode', async () => {
    render(<LocationMap coordinates={{ lat: -6.2, lng: 106.85 }} radius={100} readOnly />);
    await act(async () => {});
    expect(clickHandlers['click']).toBeUndefined();
  });

  it('creates a draggable marker in edit mode and emits coords on dragend', async () => {
    let result: { lat: number; lng: number } | null = null;
    render(
      <LocationMap
        coordinates={{ lat: -6.2, lng: 106.85 }}
        radius={100}
        onChange={(c) => (result = c)}
      />
    );
    await act(async () => {});
    await act(async () => {
      markerHandlers['dragend']?.();
    });
    expect(result).toEqual({ lat: -6.2, lng: 106.85 });
  });

  it('adds geofence polygon layers on load', async () => {
    render(<LocationMap coordinates={{ lat: -6.2, lng: 106.85 }} radius={250} />);
    await act(async () => {});
    await act(async () => {
      clickHandlers['load']?.({});
    });
    expect(layerIds).toContain('geofence-fill');
    expect(layerIds).toContain('geofence-line');
    expect(layerIds).toContain('geofence-center');
  });

  it('adds a device-location marker when provided', async () => {
    render(
      <LocationMap
        coordinates={{ lat: -6.2, lng: 106.85 }}
        radius={100}
        deviceLocation={{ lat: -6.21, lng: 106.86, accuracy: 10 }}
      />
    );
    await act(async () => {});
    expect(FakeMarker).toBeTruthy();
  });

  it('emits coordinates when the geolocate control reports a user location', async () => {
    let result: { lat: number; lng: number } | null = null;
    render(
      <LocationMap
        coordinates={{ lat: -6.2, lng: 106.85 }}
        radius={100}
        onChange={(c) => (result = c)}
      />
    );
    await act(async () => {});
    await act(async () => {
      geolocateHandlers['geolocate']?.({
        coords: { latitude: -6.25, longitude: 106.9 }
      });
    });
    expect(result).toEqual({ lat: -6.25, lng: 106.9 });
  });

  it('does not register a geolocate listener in read-only mode', async () => {
    render(<LocationMap coordinates={{ lat: -6.2, lng: 106.85 }} radius={100} readOnly />);
    await act(async () => {});
    expect(geolocateHandlers['geolocate']).toBeUndefined();
  });

  it('shows a geolocation-unavailable banner and skips the locate control when geolocation is unsupported', async () => {
    setGeoSupported(false);
    render(<LocationMap coordinates={{ lat: -6.2, lng: 106.85 }} radius={100} />);
    await act(async () => {});
    expect(screen.getByTestId('geo-unavailable-banner')).toBeTruthy();
    expect(FakeGeolocateControl.instances).toBe(0);
  });

  it('auto-requests the browser location on mount and fills the coordinates from the result', async () => {
    let result: { lat: number; lng: number } | null = null;
    render(
      <LocationMap
        coordinates={{ lat: -6.2, lng: 106.85 }}
        radius={100}
        onChange={(c) => (result = c)}
      />
    );
    await act(async () => {});
    expect(geolocationMock).toHaveBeenCalledTimes(1);
    const success = geolocationMock.mock.calls[0][0] as (p: {
      coords: { latitude: number; longitude: number };
    }) => void;
    await act(async () => {
      success({ coords: { latitude: -6.3, longitude: 106.8 } });
    });
    expect(result).toEqual({ lat: -6.3, lng: 106.8 });
  });

  it('reports the auto location request failure via onGeoError', async () => {
    const onGeoError = vi.fn();
    render(
      <LocationMap coordinates={{ lat: -6.2, lng: 106.85 }} radius={100} onGeoError={onGeoError} />
    );
    await act(async () => {});
    const error = geolocationMock.mock.calls[0][1] as (e: {
      code: number;
      message: string;
    }) => void;
    await act(async () => {
      error({ code: 1, message: 'Permission denied' });
    });
    expect(onGeoError).toHaveBeenCalledWith(1, 'Permission denied');
  });
});
