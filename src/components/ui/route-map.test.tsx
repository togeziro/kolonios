// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

// Mock the dynamically-imported maplibre-gl module before the component runs
// `await import('maplibre-gl')` — vi.mock intercepts dynamic imports too.
const { mapMock, MapMock, MarkerMock, BoundsMock } = vi.hoisted(() => {
  const handlers: Record<string, () => void> = {};
  const mapMock = {
    on: vi.fn((event: string, cb: () => void) => {
      handlers[event] = cb;
    }),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    addControl: vi.fn(),
    remove: vi.fn(),
    fitBounds: vi.fn(),
    getSource: vi.fn(),
    _emitLoad: () => handlers['load']?.()
  };
  // Regular (non-arrow) functions: the component constructs these with `new`,
  // and vi.fn(arrow) throws "not a constructor" under @vitest/spy.
  const MapMock = vi.fn(function MapMock() {
    return mapMock;
  });
  const MarkerMock = vi.fn(function MarkerMock() {
    return {
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn()
    };
  });
  const BoundsMock = vi.fn(function BoundsMock() {
    return { extend: vi.fn().mockReturnThis() };
  });
  return { mapMock, MapMock, MarkerMock, BoundsMock };
});

vi.mock('maplibre-gl', () => ({
  Map: MapMock,
  Marker: MarkerMock,
  LngLatBounds: BoundsMock,
  NavigationControl: vi.fn()
}));

import { EnRouteMap } from '@/components/ui/route-map';
import type { DeviceLocation } from '@/features/attendance/utils/geolocation';

const DEVICE: DeviceLocation = {
  latitude: -6.2,
  longitude: 106.8,
  accuracy: 10,
  capturedAt: Date.now()
};
const DEST = { lat: -6.21, lng: 106.81 };

function renderMap(props: Partial<Parameters<typeof EnRouteMap>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <EnRouteMap deviceLocation={null} destination={null} onDeviceFix={() => {}} {...props} />
    </I18nextProvider>
  );
}

describe('EnRouteMap', () => {
  beforeEach(() => {
    mapMock.getSource.mockReturnValue({ setData: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('initializes the map and adds the route source/layer after the dynamic import resolves', async () => {
    renderMap();
    // init() is async; flush microtasks so `await import('maplibre-gl')` lands.
    await waitFor(() => expect(mapMock.on).toHaveBeenCalled());
    mapMock._emitLoad();

    await waitFor(() => expect(mapMock.addSource).toHaveBeenCalledWith('route', expect.anything()));
    expect(mapMock.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'route-line', type: 'line' })
    );
  });

  it('draws the guide line and fits bounds when device and destination fixes exist', async () => {
    renderMap({ deviceLocation: DEVICE, destination: DEST });
    await waitFor(() => expect(mapMock.on).toHaveBeenCalled());
    mapMock._emitLoad();

    await waitFor(() => expect(mapMock.getSource).toHaveBeenCalledWith('route'));
    await waitFor(() => expect(mapMock.fitBounds).toHaveBeenCalled());
    expect(MapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [DEVICE.longitude, DEVICE.latitude]
      })
    );
  });

  it('rejects a Null Island device fix (no fitBounds, empty line)', async () => {
    renderMap({ destination: DEST });
    await waitFor(() => expect(mapMock.on).toHaveBeenCalled());
    mapMock._emitLoad();

    const nullIsland = { ...DEVICE, latitude: 0, longitude: 0 };
    renderMap({ deviceLocation: nullIsland, destination: DEST });

    await waitFor(() => expect(mapMock.getSource).toHaveBeenCalled());
    expect(mapMock.fitBounds).not.toHaveBeenCalled();
  });

  it('shows the locate-me button and pipes a plausible fix through onDeviceFix', async () => {
    const onDeviceFix = vi.fn();
    renderMap({ destination: DEST, onDeviceFix });
    await waitFor(() => expect(mapMock.on).toHaveBeenCalled());

    const fakePosition = {
      coords: { latitude: -6.3, longitude: 106.9, accuracy: 8 },
      timestamp: Date.now()
    };
    vi.stubGlobal(
      'navigator',
      Object.assign(Object.create(Object.getPrototypeOf(navigator)), navigator, {
        geolocation: {
          getCurrentPosition: (ok: (p: unknown) => void) => ok(fakePosition)
        }
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /find my location/i }));

    await waitFor(() =>
      expect(onDeviceFix).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: -6.3, longitude: 106.9, accuracy: 8 })
      )
    );
    vi.unstubAllGlobals();
  });
});
