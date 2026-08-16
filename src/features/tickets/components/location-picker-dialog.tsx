import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Map, type MapCoordinates } from '@/components/ui/map';

interface LocationPickerResult {
  lat: number;
  lng: number;
  accuracy: number;
}

interface LocationPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: LocationPickerResult) => void;
}

export function LocationPickerDialog({ isOpen, onClose, onConfirm }: LocationPickerDialogProps) {
  const { t } = useTranslation();
  const [coords, setCoords] = useState<MapCoordinates | null>(null);
  const [accuracy, setAccuracy] = useState(0);

  const handleGeoError = (code: number, message: string) => {
    toast.error(t('workSession.logLocationFailed'), { description: message });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('workSession.locationPickerTitle')}</DialogTitle>
          <DialogDescription>{t('workSession.locationPickerDescription')}</DialogDescription>
        </DialogHeader>

        <div className='h-[280px] overflow-hidden rounded-md border'>
          <Map
            coordinates={coords}
            radius={0}
            readOnly={false}
            onChange={(c) => setCoords(c)}
            onGeoError={handleGeoError}
            className='h-[280px] w-full'
          />
        </div>

        {coords && (
          <p className='text-center text-xs text-muted-foreground'>
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            {accuracy > 0 ? ` ±${Math.round(accuracy)}m` : ''}
          </p>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!coords}
            onClick={() => {
              if (coords) {
                onConfirm({ lat: coords.lat, lng: coords.lng, accuracy });
                setCoords(null);
                setAccuracy(0);
              }
            }}
          >
            {t('workSession.locationPickerConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
