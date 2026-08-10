import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { locationsQueryOptions } from '../api/queries';
import { deleteLocationFn } from '../api/service';
import { LocationForm, type LocationFormState } from './admin-location-form';

export function LocationManagePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState<LocationFormState | undefined>();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery(locationsQueryOptions());
  const locations = data?.locations ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLocationFn({ data: { id } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('attendanceAdmin.locationDeleted'));
        queryClient.invalidateQueries({
          queryKey: ['attendance', 'locations']
        });
        setEditing(undefined);
      } else {
        toast.error(t('attendanceAdmin.locationDeleteFailed'));
      }
    },
    onError: () => toast.error(t('attendanceAdmin.locationDeleteFailed'))
  });

  const handleEdit = (loc: (typeof locations)[number]) => {
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
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className='grid gap-6 lg:grid-cols-2 [&>*]:min-w-0'>
      <div ref={formRef} className='order-2 lg:order-1'>
        <LocationForm initial={editing} />
      </div>

      <Card className='order-1 lg:order-2'>
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
              <div
                key={loc.id}
                className='flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='min-w-0'>
                  <p className='text-sm font-medium'>{loc.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {loc.latitude?.toFixed(4) ?? '-'}, {loc.longitude?.toFixed(4) ?? '-'} {'\u00b7'}{' '}
                    {loc.radius}
                    {t('attendanceAdmin.radiusUnit')}
                  </p>
                  <div className='mt-1 flex flex-wrap gap-1'>
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
                <div className='flex justify-end gap-2 sm:justify-normal relative z-10'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='cursor-pointer'
                    onClick={() => handleEdit(loc)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type='button'
                    variant='destructive'
                    size='sm'
                    className='cursor-pointer'
                    onClick={() => setDeletingId(loc.id)}
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

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        title={t('attendanceAdmin.deleteLocationConfirmTitle')}
        description={t('attendanceAdmin.deleteLocationConfirmDescription')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => {
          if (deletingId !== null) deleteMutation.mutate(deletingId);
        }}
      />
    </div>
  );
}
