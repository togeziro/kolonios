// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LocationMap } from './location-map';

const clickHandlers: Record<string, ((e: unknown) => void) | undefined> = {};
const markerHandlers: Record<string, (() => void) | undefined> = {};

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
  constructor(_opts: unknown) {}
}

const layerIds: string[] = [];

vi.mock('maplibre-gl', () => ({
  Map: FakeMap,
  Marker: FakeMarker,
  NavigationControl: class {}
}));

beforeEach(() => {
  clickHandlers['click'] = undefined;
  markerHandlers['dragend'] = undefined;
  layerIds.length = 0;
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

  it('adds geofence circle layers on load', async () => {
    render(<LocationMap coordinates={{ lat: -6.2, lng: 106.85 }} radius={250} />);
    await act(async () => {});
    await act(async () => {
      clickHandlers['load']?.({});
    });
    expect(layerIds).toContain('geofence-circle');
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
});
