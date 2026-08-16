import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Icons } from '@/components/icons';
import { useWorklogSettings, useSetWorklogSettings } from '../api';

export function WorklogSettingsCard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useWorklogSettings();
  const setSettings = useSetWorklogSettings();

  const checked = data?.lenient === true;
  const disabled = isLoading || setSettings.isPending;

  const toggle = async (next: boolean) => {
    try {
      await setSettings.mutateAsync({ lenient: next });
      toast.success(next ? t('worklogSettings.enabled') : t('worklogSettings.disabled'));
    } catch {
      toast.error(t('worklogSettings.saveFailed'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Icons.location className='h-5 w-5' />
          {t('worklogSettings.title')}
        </CardTitle>
        <CardDescription>{t('worklogSettings.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className='text-sm text-destructive'>{t('worklogSettings.loadFailed')}</p>
        ) : (
          <div className='flex items-start justify-between gap-4'>
            <div className='space-y-1'>
              <p className='text-sm font-medium'>{t('worklogSettings.lenientLabel')}</p>
              <p className='text-xs text-muted-foreground'>{t('worklogSettings.lenientHint')}</p>
            </div>
            <Switch
              aria-label={t('worklogSettings.lenientLabel')}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) => void toggle(value)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
