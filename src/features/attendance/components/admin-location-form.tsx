import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LocationMap } from './location-map';
import { createLocationFn, updateLocationFn } from '../api/service';
import type { MapCoordinates } from '@/components/ui/map';

export interface LocationFormState {
  id?: number;
  name: string;
  description: string;
  radius: number;
  latitude?: number;
  longitude?: number;
  gpsValidationEnabled: boolean;
  selfieRequired: boolean;
  maxAccuracyMeters: number;
  maxStaleMs: number;
}

const emptyForm: LocationFormState = {
  name: '',
  description: '',
  radius: 100,
  gpsValidationEnabled: true,
  selfieRequired: false,
  maxAccuracyMeters: 50,
  maxStaleMs: 30000
};

export function LocationForm({ initial }: { initial?: Partial<LocationFormState> }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LocationFormState>({
    ...emptyForm,
    ...initial
  });

  // Update form when initial prop changes (for editing)
  useEffect(() => {
    if (initial) {
      setForm({ ...emptyForm, ...initial });
    }
  }, [initial]);

  const set = <K extends keyof LocationFormState>(key: K, value: LocationFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleCoords = (coords: MapCoordinates) => {
    set('latitude', coords.lat);
    set('longitude', coords.lng);
  };

  const handleGeoError = (code: number, message: string) => {
    if (code === 1) {
      toast.error(t('attendanceAdmin.geoPermissionDenied'));
    } else {
      toast.error(t('attendanceAdmin.geoFixFailed'));
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance', 'locations'] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createLocationFn({
        data: {
          name: form.name,
          description: form.description || undefined,
          radius: form.radius,
          latitude: form.latitude,
          longitude: form.longitude,
          gpsValidationEnabled: form.gpsValidationEnabled,
          selfieRequired: form.selfieRequired,
          maxAccuracyMeters: form.maxAccuracyMeters,
          maxStaleMs: form.maxStaleMs
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendanceAdmin.locationSaved'));
        invalidate();
        setForm(emptyForm);
      } else {
        toast.error(t('attendanceAdmin.locationSaveFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.locationSaveFailed'))
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateLocationFn({
        data: {
          id: form.id!,
          name: form.name,
          description: form.description || undefined,
          radius: form.radius,
          latitude: form.latitude,
          longitude: form.longitude,
          gpsValidationEnabled: form.gpsValidationEnabled,
          selfieRequired: form.selfieRequired,
          maxAccuracyMeters: form.maxAccuracyMeters,
          maxStaleMs: form.maxStaleMs
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendanceAdmin.locationSaved'));
        invalidate();
      } else {
        toast.error(t('attendanceAdmin.locationSaveFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.locationSaveFailed'))
  });

  const submit = () => {
    if (!form.name.trim()) {
      toast.error(t('attendanceAdmin.locationSaveFailed'));
      return;
    }
    if (form.id) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('attendanceAdmin.locationsFormTitle')}</CardTitle>
        <CardDescription>{t('attendanceAdmin.locationsFormDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='loc-name'>{t('attendanceAdmin.locationName')}</Label>
            <Input
              id='loc-name'
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t('attendanceAdmin.locationNamePlaceholder')}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='loc-radius'>{t('attendanceAdmin.radius')}</Label>
            <Input
              id='loc-radius'
              type='number'
              min={1}
              value={form.radius}
              onChange={(e) => set('radius', Number(e.target.value))}
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='loc-desc'>{t('attendanceAdmin.description')}</Label>
          <Input
            id='loc-desc'
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='loc-lat'>{t('attendanceAdmin.latitude')}</Label>
            <Input
              id='loc-lat'
              type='number'
              step='any'
              value={form.latitude ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                set('latitude', value === '' ? undefined : Number(value));
              }}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='loc-lng'>{t('attendanceAdmin.longitude')}</Label>
            <Input
              id='loc-lng'
              type='number'
              step='any'
              value={form.longitude ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                set('longitude', value === '' ? undefined : Number(value));
              }}
            />
          </div>
        </div>

        <LocationMap
          coordinates={
            form.latitude != null && form.longitude != null
              ? { lat: form.latitude, lng: form.longitude }
              : null
          }
          radius={form.radius}
          onChange={handleCoords}
          onGeoError={handleGeoError}
        />

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='flex items-center justify-between rounded-md border p-3'>
            <div>
              <Label>{t('attendanceAdmin.gpsValidation')}</Label>
              <p className='text-xs text-muted-foreground'>
                {t('attendanceAdmin.gpsValidationHint')}
              </p>
            </div>
            <Switch
              checked={form.gpsValidationEnabled}
              onCheckedChange={(v) => set('gpsValidationEnabled', v)}
            />
          </div>
          <div className='flex items-center justify-between rounded-md border p-3'>
            <Label>{t('attendanceAdmin.selfieRequired')}</Label>
            <Switch
              checked={form.selfieRequired}
              onCheckedChange={(v) => set('selfieRequired', v)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='loc-accuracy'>{t('attendanceAdmin.maxAccuracy')}</Label>
            <Input
              id='loc-accuracy'
              type='number'
              min={1}
              value={form.maxAccuracyMeters}
              onChange={(e) => set('maxAccuracyMeters', Number(e.target.value))}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='loc-stale'>{t('attendanceAdmin.maxStale')}</Label>
            <Input
              id='loc-stale'
              type='number'
              min={1}
              value={form.maxStaleMs}
              onChange={(e) => set('maxStaleMs', Number(e.target.value))}
            />
          </div>
        </div>

        <Button onClick={submit} disabled={pending}>
          {t('attendanceAdmin.saveLocation')}
        </Button>
      </CardContent>
    </Card>
  );
}
