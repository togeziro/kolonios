import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { useAppForm } from '@/components/ui/tanstack-form';
import { useHolidayApiSettings, useUpdateHolidayApiSettings } from '../api';
import type { HolidayApiProvider } from '../api';
import type { CompanySetting } from '@/lib/db/schema/masterdata';

interface HolidayApiSettingsForm {
  provider: HolidayApiProvider;
  url: string;
  api_key: string;
  country_code: string;
}

const defaultSettings: HolidayApiSettingsForm = {
  provider: 'nager_date',
  url: '',
  api_key: '',
  country_code: 'ID'
};

const providers: HolidayApiProvider[] = ['nager_date', 'openholidays', 'custom'];

const providerLabels: Record<HolidayApiProvider, string> = {
  nager_date: 'holiday.providerNagerDate',
  openholidays: 'holiday.providerOpenHolidays',
  custom: 'holiday.providerCustom'
};

function mapSettings(settings: CompanySetting | null | undefined): HolidayApiSettingsForm {
  if (!settings) return defaultSettings;

  const provider = providers.includes(settings.holiday_api_provider as HolidayApiProvider)
    ? (settings.holiday_api_provider as HolidayApiProvider)
    : 'custom';

  return {
    provider,
    url: settings.holiday_api_url ?? '',
    api_key: settings.holiday_api_key ?? '',
    country_code: settings.holiday_api_country_code || 'ID'
  };
}

export function HolidayApiSettings() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useHolidayApiSettings();
  const updateSettings = useUpdateHolidayApiSettings();

  const form = useAppForm({
    defaultValues: defaultSettings,
    onSubmit: async ({ value }) => {
      try {
        await updateSettings.mutateAsync({
          provider: value.provider,
          url: value.url,
          api_key: value.api_key,
          country_code: value.country_code
        });
        toast.success(t('holiday.settingsSaved'));
      } catch {
        toast.error(t('holiday.settingsSaveFailed'));
      }
    }
  });

  // Ref instead of state: the flag only guards a one-time external-system
  // sync (form.reset), so no re-render is needed when it flips.
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (data && !hydratedRef.current) {
      hydratedRef.current = true;
      form.reset(mapSettings(data.settings));
    }
  }, [data, form]);

  const isPending = updateSettings.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Icons.settings className='h-5 w-5' />
          {t('holiday.apiSettings')}
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
          <p className='text-sm text-destructive'>{t('holiday.settingsLoadFailed')}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
            className='flex flex-col gap-5'
          >
            <p className='text-muted-foreground text-sm'>{t('holiday.apiSettingsDescription')}</p>

            <div className='grid gap-5 sm:grid-cols-2'>
              <form.AppField name='provider'>
                {(field) => (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor={field.name}>{t('holiday.apiProvider')}</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as HolidayApiProvider)}
                    >
                      <SelectTrigger id={field.name} className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {t(providerLabels[provider])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className='text-muted-foreground text-xs'>
                      {t('holiday.apiProviderDescription')}
                    </p>
                  </div>
                )}
              </form.AppField>

              <form.AppField name='country_code'>
                {(field) => (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor={field.name}>{t('holiday.countryCode')}</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={t('holiday.countryCodePlaceholder')}
                      required
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className='text-destructive text-sm'>{t('holiday.countryCodeInvalid')}</p>
                    )}
                  </div>
                )}
              </form.AppField>

              <form.AppField name='url'>
                {(field) => (
                  <div className='flex flex-col gap-2 sm:col-span-2'>
                    <Label htmlFor={field.name}>{t('holiday.apiUrl')}</Label>
                    <Input
                      id={field.name}
                      type='url'
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={t('holiday.apiUrlPlaceholder')}
                    />
                    <p className='text-muted-foreground text-xs'>{t('holiday.apiUrlHelp')}</p>
                  </div>
                )}
              </form.AppField>

              <form.AppField name='api_key'>
                {(field) => (
                  <div className='flex flex-col gap-2 sm:col-span-2'>
                    <Label htmlFor={field.name}>{t('holiday.apiKey')}</Label>
                    <Input
                      id={field.name}
                      type='password'
                      autoComplete='off'
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={t('holiday.apiKeyPlaceholder')}
                    />
                    <span className='text-muted-foreground text-xs'>{t('holiday.apiKeyHelp')}</span>
                  </div>
                )}
              </form.AppField>
            </div>

            <div className='flex justify-end pt-1'>
              <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit]) => (
                  <Button type='submit' disabled={!canSubmit || isPending}>
                    {isPending && <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />}
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
