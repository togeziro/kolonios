import * as React from 'react';
// MapLibre CSS is imported once here; both the admin geofence map and the
// employee check-in map render through this component.
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Polygon, Position } from 'geojson';

export type MapCoordinates = { lat: number; lng: number };

export type DeviceLocation = MapCoordinates & { accuracy: number };

export interface MapProps {
  coordinates: MapCoordinates | null;
  radius: number;
  readOnly?: boolean;
  onChange?: (coords: MapCoordinates) => void;
  deviceLocation?: DeviceLocation | null;
  className?: string;
  style?: React.CSSProperties;
}

// Meters per degree at the equator (equirectangular approximation).
const METERS_PER_DEG_LAT = 110540;
const GEOFENCE_POINTS = 64;

/**
 * Build a GeoJSON polygon approximating a circle of `radiusMeters` around
 * `center`. MapLibre circle layers only accept pixel radii, so the fence is
 * drawn as a polygon computed from meters — it stays accurate at any zoom.
 */
function buildGeofencePolygon(center: MapCoordinates, radiusMeters: number): Polygon | null {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return null;
  const latR = radiusMeters / METERS_PER_DEG_LAT;
  const lngR = radiusMeters / (METERS_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
  const ring: Position[] = [];
  for (let i = 0; i < GEOFENCE_POINTS; i++) {
    const angle = (i / GEOFENCE_POINTS) * 2 * Math.PI;
    ring.push([center.lng + lngR * Math.cos(angle), center.lat + latR * Math.sin(angle)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

/**
 * MapLibre-based interactive map used for geofence configuration.
 *
 * - Click on the map (or drag the marker) updates `onChange` coordinates.
 * - A polygon shows the geofence radius in meters; it is recomputed on every
 *   move and whenever `coordinates`/`radius` change.
 * - `deviceLocation` is display-only (used to preview the employee's position).
 *
 * MapLibre is loaded dynamically so the module never touches the server.
 */
export function Map({
  coordinates,
  radius,
  readOnly = false,
  onChange,
  deviceLocation,
  className,
  style
}: MapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any | null>(null);
  const markerRef = React.useRef<any | null>(null);
  const deviceMarkerRef = React.useRef<any | null>(null);
  const geofenceRef = React.useRef({ center: coordinates, radius });
  const layerIdsRef = React.useRef<string[]>([]);

  const updateGeofence = React.useCallback((map: any) => {
    const polygonSource = map.getSource('geofence');
    const centerSource = map.getSource('geofence-center');
    if (!polygonSource || !centerSource) return;
    const { center, radius: radiusMeters } = geofenceRef.current;
    const polygon = center ? buildGeofencePolygon(center, radiusMeters) : null;
    polygonSource.setData({
      type: 'Feature',
      properties: {},
      geometry: polygon ?? { type: 'Polygon', coordinates: [] }
    });
    centerSource.setData({
      type: 'Feature',
      properties: {},
      geometry: center
        ? { type: 'Point', coordinates: [center.lng, center.lat] }
        : { type: 'Point', coordinates: [0, 0] }
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let map: any = null;
    let ml: typeof import('maplibre-gl') | null = null;

    async function init() {
      try {
        ml = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;

        // Raster tile template URL, e.g.
        // https://tile.openstreetmap.org/{z}/{x}/{y}.png — not a style JSON.
        const tileUrl =
          (import.meta as any).env?.VITE_MAP_TILE_URL ??
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

        const baseStyle = {
          version: 8,
          sources: {
            osm: {
              type: 'raster' as const,
              tiles: [tileUrl],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }]
        };

        map = new ml.Map({
          container: containerRef.current,
          style: baseStyle as never,
          center: coordinates ? [coordinates.lng, coordinates.lat] : [106.8456, -6.2088],
          zoom: 13
        });
        mapRef.current = map;

        map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');

        if (coordinates) {
          markerRef.current = new ml.Marker({ draggable: !readOnly })
            .setLngLat([coordinates.lng, coordinates.lat])
            .addTo(map);

          if (!readOnly && onChange) {
            markerRef.current.on('dragend', () => {
              const lngLat = markerRef.current?.getLngLat();
              if (lngLat) onChange({ lat: lngLat.lat, lng: lngLat.lng });
            });
          }
        }

        if (deviceLocation) {
          deviceMarkerRef.current = new ml.Marker({ color: '#2563eb' })
            .setLngLat([deviceLocation.lng, deviceLocation.lat])
            .addTo(map);
        }

        map.on('load', () => {
          if (cancelled || !map) return;
          map.addSource('geofence', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'Polygon', coordinates: [] }
            }
          });
          map.addSource('geofence-center', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: [0, 0] }
            }
          });
          map.addLayer({
            id: 'geofence-fill',
            type: 'fill',
            source: 'geofence',
            paint: {
              'fill-color': 'rgba(59, 130, 246, 0.15)',
              'fill-outline-color': '#3b82f6'
            }
          });
          map.addLayer({
            id: 'geofence-line',
            type: 'line',
            source: 'geofence',
            paint: {
              'line-color': '#3b82f6',
              'line-width': 2
            }
          });
          map.addLayer({
            id: 'geofence-center',
            type: 'circle',
            source: 'geofence-center',
            paint: {
              'circle-radius': 5,
              'circle-color': '#3b82f6',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2
            }
          });
          layerIdsRef.current = ['geofence-fill', 'geofence-line', 'geofence-center'];
          updateGeofence(map);
        });

        // Keep the fence glued to the map while panning/zooming.
        map.on('moveend', () => updateGeofence(map));

        if (!readOnly && onChange) {
          map.on('click', (e: { lngLat: { lat: number; lng: number } }) => {
            onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          });
        }
      } catch {
        // Network/provider failure: leave the container empty; the page
        // renders its own fallback message beside the map.
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // already removed
        }
      }
      mapRef.current = null;
      markerRef.current = null;
      deviceMarkerRef.current = null;
      layerIdsRef.current = [];
    };
  }, []);

  // Update marker/fence when coordinates or radius change from outside.
  React.useEffect(() => {
    geofenceRef.current = { center: coordinates, radius };
    const map = mapRef.current as any;
    if (!map || !coordinates) return;
    if (markerRef.current) markerRef.current.setLngLat([coordinates.lng, coordinates.lat]);
    updateGeofence(map);
  }, [coordinates, radius, updateGeofence]);

  return (
    <div ref={containerRef} className={className} style={style} data-testid='attendance-map' />
  );
}
