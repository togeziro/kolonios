import * as React from 'react';

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

/**
 * MapLibre-based interactive map used for geofence configuration.
 *
 * - Click on the map (or drag the marker) updates `onChange` coordinates.
 * - A circle shows the geofence radius in meters.
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
  const circleRef = React.useRef<any | null>(null);
  const deviceMarkerRef = React.useRef<any | null>(null);
  const layerIdsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    let map: any = null;
    let ml: typeof import('maplibre-gl') | null = null;

    async function init() {
      try {
        ml = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;

        const styleUrl =
          (import.meta as any).env?.VITE_MAP_STYLE_URL ??
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

        const baseStyle = {
          version: 8,
          sources: {
            osm: {
              type: 'raster' as const,
              tiles: [styleUrl],
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
              geometry: coordinates
                ? {
                    type: 'Point',
                    coordinates: [coordinates.lng, coordinates.lat]
                  }
                : { type: 'Point', coordinates: [0, 0] }
            }
          });
          map.addLayer({
            id: 'geofence-circle',
            type: 'circle',
            source: 'geofence',
            paint: {
              'circle-radius': {
                stops: [
                  [0, 0],
                  [20, radius * 0.1]
                ],
                base: 2
              },
              'circle-color': 'rgba(59, 130, 246, 0.15)',
              'circle-stroke-color': '#3b82f6',
              'circle-stroke-width': 2
            }
          });
          map.addLayer({
            id: 'geofence-center',
            type: 'circle',
            source: 'geofence',
            paint: {
              'circle-radius': 5,
              'circle-color': '#3b82f6',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2
            }
          });
          layerIdsRef.current = ['geofence-circle', 'geofence-center'];
          circleRef.current = map.getSource('geofence');
        });

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
      circleRef.current = null;
      layerIdsRef.current = [];
    };
  }, []);

  // Update marker/circle when coordinates change from outside.
  React.useEffect(() => {
    const map = mapRef.current as any;
    if (!map || !coordinates) return;
    if (markerRef.current) markerRef.current.setLngLat([coordinates.lng, coordinates.lat]);
    if (circleRef.current) {
      circleRef.current.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] }
      });
    }
  }, [coordinates]);

  return (
    <div ref={containerRef} className={className} style={style} data-testid='attendance-map' />
  );
}
