import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { setAppLocale } from '@/lib/locale';
import { APP_LOCALES, type AppLocale } from '@/lib/locale/types';
import { useAppLocale, useUpdateAppLocale } from '@/features/settings/api';

export function CompanyLocaleSettings() {
  const { t } = useTranslation();
  const currentLocale = useAppLocale();
  const [value, setValue] = useState<AppLocale>(currentLocale);
  useEffect(() => {
    setValue(currentLocale);
  }, [currentLocale]);
  const update = useUpdateAppLocale();
  const isPending = update.isPending;

  const save = async () => {
    try {
      await update.mutateAsync(value);
      setAppLocale(value);
      toast.success(t('settings.localeSaved'));
    } catch {
      toast.error(t('settings.localeSaveFailed'));
    }
  };

  const options: Record<AppLocale, string> = {
    'id-ID': t('settings.localeIndonesia'),
    'en-US': t('settings.localeEnglish')
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>{t('settings.locale')}</CardTitle>
        <CardDescription>{t('settings.localeDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='company-locale'>{t('settings.locale')}</Label>
          <NativeSelect
            id='company-locale'
            value={value}
            onChange={(e) => setValue(e.target.value as AppLocale)}
          >
            {APP_LOCALES.map((localeValue) => (
              <option key={localeValue} value={localeValue}>
                {options[localeValue]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className='flex justify-end'>
          <Button onClick={save} disabled={isPending || value === currentLocale}>
            {isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
