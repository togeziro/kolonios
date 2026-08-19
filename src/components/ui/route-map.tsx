import * as React from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { useTranslation } from 'react-i18next';
import type { DeviceLocation } from '@/features/attendance/utils/geolocation';
import { Icons } from '@/components/icons';
import { emptyLine, isPlausibleFix, routeLine, type MapCoordinates } from './route-map.utils';

export type { MapCoordinates };

export interface EnRouteMapProps {
  deviceLocation: DeviceLocation | null;
  destination: MapCoordinates | null;
  className?: string;
  style?: React.CSSProperties;
  onDeviceFix?: (location: DeviceLocation) => void;
}

function hasCoords(coords: MapCoordinates | null | undefined): coords is MapCoordinates {
  return !!coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng);
}

/**
 * MapLibre preview map for the En Route screen: shows the device position
 * (blue) and the ticket destination (orange) with a straight helper line.
 * Static preview only — real navigation hands off to the phone's maps app
 * via the "Open Maps" button on the page. MapLibre is loaded dynamically so
 * the module never touches the server.
 */
export function EnRouteMap({
  deviceLocation,
  destination,
  className,
  style,
  onDeviceFix
}: EnRouteMapProps) {
  const { t } = useTranslation();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const mlRef = React.useRef<typeof import('maplibre-gl') | null>(null);
  const deviceMarkerRef = React.useRef<MapLibreMarker | null>(null);
  const destinationMarkerRef = React.useRef<MapLibreMarker | null>(null);
  const [mapFailed, setMapFailed] = React.useState(false);

  const deviceCoords = React.useMemo(
    () => (deviceLocation ? { lat: deviceLocation.latitude, lng: deviceLocation.longitude } : null),
    [deviceLocation]
  );
  const destinationCoords = React.useMemo(
    () =>
      hasCoords(destination) && (destination.lat !== 0 || destination.lng !== 0)
        ? destination
        : null,
    [destination]
  );

  const syncMarkers = React.useCallback(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml) return;

    const hasDeviceFix = !!deviceCoords && (deviceCoords.lat !== 0 || deviceCoords.lng !== 0);

    if (hasDeviceFix) {
      if (deviceMarkerRef.current) {
        deviceMarkerRef.current.setLngLat([deviceCoords!.lng, deviceCoords!.lat]);
      } else {
        deviceMarkerRef.current = new ml.Marker({ color: '#2563eb' })
          .setLngLat([deviceCoords!.lng, deviceCoords!.lat])
          .addTo(map);
      }
    } else if (deviceMarkerRef.current) {
      deviceMarkerRef.current.remove();
      deviceMarkerRef.current = null;
    }

    if (destinationCoords) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLngLat([destinationCoords.lng, destinationCoords.lat]);
      } else {
        destinationMarkerRef.current = new ml.Marker({ color: '#f97316' })
          .setLngLat([destinationCoords.lng, destinationCoords.lat])
          .addTo(map);
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    const geometry =
      hasDeviceFix && destinationCoords ? routeLine(deviceCoords!, destinationCoords) : emptyLine();
    const source = map.getSource('route') as { setData: (data: unknown) => void } | undefined;
    if (source) source.setData({ type: 'Feature', properties: {}, geometry });

    if (hasDeviceFix && destinationCoords) {
      // extend() handles both corner orders; a raw (a, b) constructor assumes
      // (southwest, northeast) and would flip to a world view when reversed.
      const bounds = new ml.LngLatBounds()
        .extend([deviceCoords!.lng, deviceCoords!.lat])
        .extend([destinationCoords.lng, destinationCoords.lat]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 600 });
    }
  }, [deviceCoords, destinationCoords]);

  // Always-fresh handle so the map 'load' callback runs the latest
  // syncMarkers closure (with current deviceCoords), not the one captured at
  // mount time — the mount-time fix can land before the map finishes loading.
  const syncMarkersRef = React.useRef(syncMarkers);
  syncMarkersRef.current = syncMarkers;

  React.useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let ml: typeof import('maplibre-gl') | null = null;

    async function init() {
      try {
        ml = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;

        const tileUrl =
          import.meta.env?.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

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

        const center = deviceCoords ?? destinationCoords ?? { lat: -6.2088, lng: 106.8456 };
        map = new ml.Map({
          container: containerRef.current,
          style: baseStyle as never,
          center: [center.lng, center.lat],
          zoom: 14,
          attributionControl: false
        });
        mapRef.current = map;
        mlRef.current = ml;

        map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', () => {
          if (cancelled || !map) return;
          map.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: emptyLine() }
          });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': '#2563eb',
              'line-width': 3,
              'line-dasharray': [2, 1.5]
            }
          });
          syncMarkersRef.current();
        });
      } catch {
        setMapFailed(true);
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
      mlRef.current = null;
      deviceMarkerRef.current = null;
      destinationMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive markers + guide line: device fix can arrive after the map
  // finished initializing, so markers/route update whenever coords change.
  React.useEffect(() => {
    syncMarkers();
  }, [syncMarkers]);

  const [locating, setLocating] = React.useState(false);

  const locateMe = () => {
    if (locating || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = position.coords;
        // Same plausibility bar as getCurrentLocation (max accuracy 100m):
        // rejects wild fixes like ocean coordinates with huge error radii.
        if (!isPlausibleFix(latitude, longitude)) return;
        if (!Number.isFinite(accuracy) || accuracy > 100) return;
        onDeviceFix?.({
          latitude,
          longitude,
          accuracy,
          capturedAt: Date.now()
        });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  return (
    <div className={className} style={style}>
      {mapFailed ? (
        <p role='alert' className='mb-2 text-xs text-muted-foreground'>
          {t('enRoute.mapFailed')}
        </p>
      ) : null}
      <div className='relative h-full w-full'>
        <div ref={containerRef} data-testid='en-route-map' className='h-full w-full' />
        <button
          type='button'
          aria-label={t('enRoute.findMyLocation')}
          onClick={locateMe}
          disabled={locating}
          className='absolute right-2 bottom-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
        >
          {locating ? (
            <Icons.spinner className='h-4 w-4 animate-spin' />
          ) : (
            <Icons.location className='h-4 w-4' />
          )}
        </button>
      </div>
    </div>
  );
}
