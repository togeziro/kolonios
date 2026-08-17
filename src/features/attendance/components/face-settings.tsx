import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from 'react-i18next';

interface FaceSettingsProps {
  initialShowSeconds?: boolean;
  initialValidationMode?: 'realtime' | 'background';
  initialAccuracyLevel?: 'loose' | 'medium' | 'tight';
  onSave: (settings: {
    showSeconds: boolean;
    validationMode: 'realtime' | 'background';
    accuracyLevel: 'loose' | 'medium' | 'tight';
  }) => void;
}

export function FaceSettings({
  initialShowSeconds = false,
  initialValidationMode = 'background',
  initialAccuracyLevel = 'medium',
  onSave
}: FaceSettingsProps) {
  const { t } = useTranslation();
  const [showSeconds, setShowSeconds] = useState(initialShowSeconds);
  const [validationMode, setValidationMode] = useState(initialValidationMode);
  const [accuracyLevel, setAccuracyLevel] = useState(initialAccuracyLevel);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    onSave({ showSeconds, validationMode, accuracyLevel });
    setSaving(false);
  };

  const accuracyLabels = ['Loose', 'Medium', 'Tight'] as const;
  const accuracyIndex = accuracyLabels.indexOf(
    accuracyLevel.toUpperCase() as (typeof accuracyLabels)[number]
  );

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
            onValueChange={(v) => setValidationMode(v as typeof validationMode)}
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
            onValueChange={([v]) =>
              setAccuracyLevel(accuracyLabels[v].toLowerCase() as typeof accuracyLevel)
            }
            max={2}
            step={1}
          />
          <div className='flex justify-between text-xs text-zinc-400'>
            {accuracyLabels.map((l) => (
              <span
                key={l}
                className={l.toLowerCase() === accuracyLevel ? 'font-medium text-white' : ''}
              >
                {l}
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
