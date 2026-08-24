import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { faceSettingsQueryOptions } from '@/features/face/api/queries';
import { updateFaceSettingsFn } from '@/features/face/api/service';
import type { FaceAccuracyLevel, FaceValidationMode } from '@/lib/face/types';

interface FaceSettingsProps {
  onSave?: (settings: {
    showSeconds: boolean;
    validationMode: FaceValidationMode;
    accuracyLevel: FaceAccuracyLevel;
  }) => void;
}

export function FaceSettings({ onSave }: FaceSettingsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery(faceSettingsQueryOptions());
  const [showSeconds, setShowSeconds] = useState(false);
  const [validationMode, setValidationMode] = useState<FaceValidationMode>('background');
  const [accuracyLevel, setAccuracyLevel] = useState<FaceAccuracyLevel>('medium');
  const [saving, setSaving] = useState(false);

  // Seed local state whenever settings data changes
  // (adjust-state-during-render pattern; replaces the previous effect).
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    if (settings) {
      setShowSeconds(settings.showSeconds);
      setValidationMode(settings.validationMode);
      setAccuracyLevel(settings.accuracyLevel);
    }
  }

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = { showSeconds, validationMode, accuracyLevel };
      await updateFaceSettingsFn({ data: payload });
      onSave?.(payload);
      queryClient.invalidateQueries({ queryKey: ['face'] });
      toast.success(t('common.saved'));
    } catch {
      toast.error(t('common.failed'));
    } finally {
      setSaving(false);
    }
  };

  const accuracyLabels: FaceAccuracyLevel[] = ['loose', 'medium', 'tight'];
  const accuracyIndex = Math.max(0, accuracyLabels.indexOf(accuracyLevel));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('faceSettings.title')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='space-y-3'>
          <Label>{t('faceSettings.showSeconds')}</Label>
          <RadioGroup
            value={showSeconds ? 'yes' : 'no'}
            onValueChange={(v) => setShowSeconds(v === 'yes')}
            className='flex gap-4'
          >
            <div className='flex items-center gap-2'>
              <RadioGroupItem value='yes' id='show-yes' />
              <Label htmlFor='show-yes'>{t('common.yes')}</Label>
            </div>
            <div className='flex items-center gap-2'>
              <RadioGroupItem value='no' id='show-no' />
              <Label htmlFor='show-no'>{t('common.no')}</Label>
            </div>
          </RadioGroup>
        </div>

        <div className='space-y-3'>
          <Label>{t('faceSettings.validationMode')}</Label>
          <RadioGroup
            value={validationMode}
            onValueChange={(v) => setValidationMode(v as FaceValidationMode)}
            className='space-y-2'
          >
            <div className='flex items-center gap-2'>
              <RadioGroupItem value='realtime' id='mode-realtime' />
              <Label htmlFor='mode-realtime'>{t('faceSettings.realtime')}</Label>
            </div>
            <div className='flex items-center gap-2'>
              <RadioGroupItem value='background' id='mode-background' />
              <Label htmlFor='mode-background'>{t('faceSettings.background')}</Label>
            </div>
          </RadioGroup>
        </div>

        <div className='space-y-3'>
          <Label>{t('faceSettings.accuracyLevel')}</Label>
          <Slider
            value={[accuracyIndex]}
            onValueChange={([v]) => setAccuracyLevel(accuracyLabels[v])}
            max={2}
            step={1}
          />
          <div className='flex justify-between text-xs text-zinc-400'>
            {accuracyLabels.map((l) => (
              <span key={l} className={l === accuracyLevel ? 'font-medium text-white' : ''}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </span>
            ))}
          </div>
        </div>

        <Button className='w-full' onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
