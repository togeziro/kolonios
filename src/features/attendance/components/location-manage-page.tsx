import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { locationsQueryOptions } from '../api/queries';
import { deleteLocationFn } from '../api/service';
import { LocationForm, type LocationFormState } from './admin-location-form';
import { useState } from 'react';

export function LocationManagePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LocationFormState | undefined>();

  const { data, isLoading } = useQuery(locationsQueryOptions());
  const locations = data?.locations ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLocationFn({ data: { id } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendanceAdmin.locationSaved'));
        queryClient.invalidateQueries({ queryKey: ['attendance', 'locations'] });
        setEditing(undefined);
      } else {
        toast.error(t('attendanceAdmin.locationSaveFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.locationSaveFailed'))
  });

  return (
    <div className='grid gap-6 lg:grid-cols-2'>
      <LocationForm initial={editing} />

      <Card>
        <CardHeader>
          <CardTitle>{t('attendanceAdmin.locationsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {isLoading ? (
            <p className='text-sm text-muted-foreground'>...</p>
          ) : locations.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{t('attendanceAdmin.noData')}</p>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className='flex items-center justify-between rounded-md border p-3'>
                <div>
                  <p className='text-sm font-medium'>{loc.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {loc.latitude?.toFixed(4) ?? '-'}, {loc.longitude?.toFixed(4) ?? '-'} {'\u00b7'}{' '}
                    {loc.radius}
                    {t('attendanceAdmin.radiusUnit')}
                  </p>
                  <div className='mt-1 flex gap-1'>
                    <Badge variant={loc.status === 'active' ? 'default' : 'secondary'}>
                      {loc.status === 'active' ? t('common.active') : t('common.inactive')}
                    </Badge>
                    {loc.gps_validation_enabled && (
                      <Badge variant='outline'>{t('attendanceAdmin.gpsBadge')}</Badge>
                    )}
                    {loc.selfie_required && (
                      <Badge variant='outline'>{t('attendanceAdmin.selfieBadge')}</Badge>
                    )}
                  </div>
                </div>
                <div className='flex gap-2 relative z-10'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='cursor-pointer'
                    onClick={() => {
                      console.log('Edit button clicked for location:', loc.id);
                      setEditing({
                        id: loc.id,
                        name: loc.name,
                        description: loc.description ?? '',
                        radius: loc.radius ?? 100,
                        latitude: loc.latitude ?? undefined,
                        longitude: loc.longitude ?? undefined,
                        gpsValidationEnabled: loc.gps_validation_enabled ?? true,
                        selfieRequired: loc.selfie_required ?? false,
                        maxAccuracyMeters: loc.max_accuracy_meters ?? 50,
                        maxStaleMs: loc.max_stale_ms ?? 30000
                      });
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type='button'
                    variant='destructive'
                    size='sm'
                    className='cursor-pointer'
                    onClick={() => {
                      console.log('Delete button clicked for location:', loc.id);
                      if (confirm('Are you sure you want to delete this location?')) {
                        deleteMutation.mutate(loc.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
