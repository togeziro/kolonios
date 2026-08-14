import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { useAppForm } from '@/components/ui/tanstack-form';
import { useMutation } from '@tanstack/react-query';
import { useStorageSettings, useUpdateStorageSettings } from '../api';
import { testStorageConnectionFn } from '../api/service';
import { STORAGE_PROVIDER_PRESETS } from '@/lib/storage/config';
import type { StorageProvider } from '@/lib/storage/types';

const providers: StorageProvider[] = ['idrive_e2', 'aws_s3', 'minio', 'cloudflare_r2', 'custom'];

interface StorageSettingsForm {
  provider: StorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

const defaultSettings: StorageSettingsForm = {
  provider: 'idrive_e2',
  endpoint: '',
  region: 'us-east-1',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  forcePathStyle: false
};

export function StorageSettings() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useStorageSettings();
  const updateSettings = useUpdateStorageSettings();

  const form = useAppForm({
    defaultValues: defaultSettings,
    onSubmit: async ({ value }) => {
      try {
        await updateSettings.mutateAsync(value);
        toast.success(t('storage.settingsSaved'));
      } catch {
        toast.error(t('storage.settingsSaveFailed'));
      }
    }
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (data?.configured && !hydrated) {
      // keepDefaultValues: without it, useForm's layout-effect option sync
      // (formApi.update) reverts the freshly reset values back to the
      // original defaultValues on the next render.
      form.reset(
        {
          provider: data.settings!.provider,
          endpoint: data.settings!.endpoint,
          region: data.settings!.region,
          bucket: data.settings!.bucket,
          accessKeyId: data.settings!.accessKeyId,
          // Secret-key round-trip rule: load blank; the stored secret is only
          // shown as masked helper text and preserved server-side on save.
          secretAccessKey: '',
          forcePathStyle: data.settings!.forcePathStyle
        },
        { keepDefaultValues: true }
      );
      setHydrated(true);
    }
  }, [data, hydrated, form]);

  const testConnection = useMutation({
    mutationFn: () => testStorageConnectionFn({ data: form.state.values }),
    onSuccess: (res) => {
      if (res.ok) toast.success(t('storage.testOk'));
      else toast.error(t('storage.testFailed', { error: res.error ?? '' }));
    },
    onError: () => toast.error(t('storage.testFailed', { error: '' }))
  });

  const applyPreset = (provider: StorageProvider) => {
    const preset = STORAGE_PROVIDER_PRESETS[provider];
    form.setFieldValue('provider', provider);
    form.setFieldValue('endpoint', form.state.values.endpoint || preset.defaultEndpoint);
    form.setFieldValue('region', form.state.values.region || preset.defaultRegion);
    form.setFieldValue('forcePathStyle', preset.forcePathStyle);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Icons.settings className='h-5 w-5' />
          {t('storage.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='bg-muted h-10 animate-pulse rounded-md' />
            <div className='bg-muted h-10 animate-pulse rounded-md' />
            <div className='bg-muted h-10 animate-pulse rounded-md' />
            <div className='bg-muted h-10 animate-pulse rounded-md' />
          </div>
        ) : isError ? (
          <p className='text-sm text-destructive'>{t('storage.settingsLoadFailed')}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
            className='flex flex-col gap-5'
          >
            <p className='text-muted-foreground text-sm'>{t('storage.description')}</p>

            <div className='grid gap-5 sm:grid-cols-2'>
              <form.AppField name='provider'>
                {(field) => (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor={field.name}>{t('storage.provider')}</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(v) => applyPreset(v as StorageProvider)}
                    >
                      <SelectTrigger id={field.name} className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p} value={p}>
                            {t(`storage.provider_${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.AppField>

              <form.AppField name='bucket'>
                {(field) => (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor={field.name}>{t('storage.bucket')}</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('storage.bucketPlaceholder')}
                      required
                    />
                  </div>
                )}
              </form.AppField>

              <form.AppField name='endpoint'>
                {(field) => (
                  <div className='flex flex-col gap-2 sm:col-span-2'>
                    <Label htmlFor={field.name}>{t('storage.endpoint')}</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('storage.endpointPlaceholder')}
                    />
                  </div>
                )}
              </form.AppField>

              <form.AppField name='region'>
                {(field) => (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor={field.name}>{t('storage.region')}</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('storage.regionPlaceholder')}
                    />
                  </div>
                )}
              </form.AppField>

              <form.AppField name='forcePathStyle'>
                {(field) => (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor={field.name}>{t('storage.forcePathStyle')}</Label>
                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </div>
                )}
              </form.AppField>

              <form.AppField name='accessKeyId'>
                {(field) => (
                  <div className='flex flex-col gap-2 sm:col-span-2'>
                    <Label htmlFor={field.name}>{t('storage.accessKey')}</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      autoComplete='off'
                      required
                    />
                  </div>
                )}
              </form.AppField>

              <form.AppField name='secretAccessKey'>
                {(field) => (
                  <div className='flex flex-col gap-2 sm:col-span-2'>
                    <Label htmlFor={field.name}>{t('storage.secretKey')}</Label>
                    <Input
                      id={field.name}
                      type='password'
                      autoComplete='off'
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={
                        data?.settings?.secretKeyMasked
                          ? t('storage.secretKeyMaskedPlaceholder')
                          : ''
                      }
                    />
                    {data?.settings?.secretKeyMasked && (
                      <span className='text-muted-foreground text-xs'>
                        {t('storage.secretKeyStoredHint', {
                          masked: data.settings.secretKeyMasked
                        })}
                      </span>
                    )}
                  </div>
                )}
              </form.AppField>
            </div>

            <div className='flex justify-end gap-2 pt-1'>
              <Button
                type='button'
                variant='outline'
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? t('storage.testing') : t('storage.testConnection')}
              </Button>
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
