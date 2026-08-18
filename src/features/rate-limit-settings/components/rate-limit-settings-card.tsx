import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { useAppForm } from '@/components/ui/tanstack-form';
import {
  useRateLimitSettings,
  useUpdateRateLimitSettings,
  useResetRateLimitSettings
} from '../api';

export function RateLimitSettingsCard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useRateLimitSettings();
  const updateSettings = useUpdateRateLimitSettings();
  const resetSettings = useResetRateLimitSettings();

  const form = useAppForm({
    defaultValues: { max: 150, windowSec: 60 },
    onSubmit: async ({ value }) => {
      try {
        await updateSettings.mutateAsync({
          max: value.max,
          windowMs: value.windowSec * 1000
        });
        toast.success(t('rateLimitSettings.saved'));
      } catch {
        toast.error(t('rateLimitSettings.saveFailed'));
      }
    }
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (data && !hydrated) {
      form.reset(
        {
          max: data.override?.max ?? data.applied.max,
          windowSec: (data.override?.windowMs ?? data.applied.windowMs) / 1000
        },
        { keepDefaultValues: true }
      );
      setHydrated(true);
    }
  }, [data, hydrated, form]);

  const isOverride = data?.override != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Icons.shield className='h-5 w-5' />
          {t('rateLimitSettings.title')}
        </CardTitle>
        <CardDescription>{t('rateLimitSettings.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='bg-muted h-10 animate-pulse rounded-md' />
            <div className='bg-muted h-10 animate-pulse rounded-md' />
          </div>
        ) : isError ? (
          <p className='text-sm text-destructive'>{t('rateLimitSettings.loadFailed')}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
            className='flex flex-col gap-5'
          >
            <p className='text-muted-foreground text-sm'>
              {t('rateLimitSettings.appliedHint', {
                max: data?.applied.max ?? '',
                window: ((data?.applied.windowMs ?? 0) / 1000).toString()
              })}
            </p>

            <div className='grid gap-5 sm:grid-cols-2'>
              <form.AppField name='max'>
                {(field) => (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor={field.name}>{t('rateLimitSettings.maxLabel')}</Label>
                    <Input
                      id={field.name}
                      type='number'
                      min={10}
                      max={10_000}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      required
                    />
                    <span className='text-muted-foreground text-xs'>
                      {t('rateLimitSettings.maxHint')}
                    </span>
                  </div>
                )}
              </form.AppField>

              <form.AppField name='windowSec'>
                {(field) => (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor={field.name}>{t('rateLimitSettings.windowLabel')}</Label>
                    <Input
                      id={field.name}
                      type='number'
                      min={1}
                      max={3600}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      required
                    />
                    <span className='text-muted-foreground text-xs'>
                      {t('rateLimitSettings.windowHint')}
                    </span>
                  </div>
                )}
              </form.AppField>
            </div>

            <div className='flex justify-end gap-2 pt-1'>
              {isOverride && (
                <Button
                  type='button'
                  variant='outline'
                  onClick={() =>
                    void resetSettings
                      .mutateAsync()
                      .then(() => toast.success(t('rateLimitSettings.resetDone')))
                  }
                  disabled={resetSettings.isPending}
                >
                  {resetSettings.isPending
                    ? t('rateLimitSettings.resetting')
                    : t('rateLimitSettings.reset')}
                </Button>
              )}
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit]) => (
                  <Button type='submit' disabled={!canSubmit || updateSettings.isPending}>
                    {updateSettings.isPending && (
                      <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    {t('common.save')}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
