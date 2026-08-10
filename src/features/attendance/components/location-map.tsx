import { Map, type MapCoordinates, type DeviceLocation } from '@/components/ui/map';

export interface LocationMapProps {
  coordinates: MapCoordinates | null;
  radius: number;
  readOnly?: boolean;
  onChange?: (coords: MapCoordinates) => void;
  onGeoError?: (code: number, message: string) => void;
  deviceLocation?: DeviceLocation | null;
  className?: string;
  height?: number;
}

export function LocationMap({
  coordinates,
  radius,
  readOnly,
  onChange,
  onGeoError,
  deviceLocation,
  className,
  height = 320
}: LocationMapProps) {
  return (
    <Map
      coordinates={coordinates}
      radius={radius}
      readOnly={readOnly}
      onChange={onChange}
      onGeoError={onGeoError}
      deviceLocation={deviceLocation}
      className={`w-full rounded-md border border-input ${className ?? ''}`}
      style={{ height }}
    />
  );
}
