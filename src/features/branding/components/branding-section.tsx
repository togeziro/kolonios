import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { decodeBase64, validateBrandingImage, type BrandingSlot } from '@/lib/branding/assets';
import { brandingSettingsQueryOptions, useUpdateBrandingSettings } from '../api';
import type { BrandingSettings } from '../api';

const SLOTS = ['logo_light', 'logo_dark', 'favicon'] as const satisfies ReadonlyArray<BrandingSlot>;

type SlotKey = BrandingSlot;

const ERROR_KEYS: Record<string, string> = {
  not_png: 'branding.errorNotPng',
  too_large: 'branding.errorTooLarge',
  bad_dimensions: 'branding.errorBadDimensions',
  malformed: 'branding.errorNotPng',
  no_alpha: 'branding.errorNoAlpha'
};

export function BrandingSection() {
  const { t } = useTranslation();
  const update = useUpdateBrandingSettings();

  const { data, isLoading, isError } = useQuery(brandingSettingsQueryOptions());
  const [profile, setProfile] = useState({ name: '', address: '', email: '', phone: '' });
  const [previews, setPreviews] = useState<Partial<Record<SlotKey, string>>>({});
  const inputRefs = useRef<Partial<Record<SlotKey, HTMLInputElement | null>>>({});

  // Seed the form when fresh settings arrive (adjust-state-during-render).
  const [prevSettings, setPrevSettings] = useState<BrandingSettings | undefined>(data);
  if (data !== prevSettings) {
    setPrevSettings(data);
    if (data) {
      setProfile({ ...data.profile });
      setPreviews({
        ...(data.logoLight ? { logo_light: data.logoLight } : {}),
        ...(data.logoDark ? { logo_dark: data.logoDark } : {}),
        ...(data.favicon ? { favicon: data.favicon } : {})
      });
    }
  }

  const handleFile = (slot: SlotKey, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const base64 = dataUrl.split(',')[1] ?? '';
      const bytes = decodeBase64(base64);
      if (!bytes) {
        toast.error(t(ERROR_KEYS.malformed));
        if (inputRefs.current[slot]) inputRefs.current[slot]!.value = '';
        return;
      }
      const result = validateBrandingImage(slot, bytes, file.type);
      if (!result.ok) {
        toast.error(t(ERROR_KEYS[result.reason]));
        if (inputRefs.current[slot]) inputRefs.current[slot]!.value = '';
        return;
      }
      setPreviews((prev) => ({ ...prev, [slot]: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (profile.name.trim().length === 0) {
      toast.error(t('branding.errorNameRequired'));
      return;
    }
    try {
      await update.mutateAsync({
        profile: {
          name: profile.name,
          address: profile.address,
          email: profile.email,
          phone: profile.phone
        },
        ...(previews.logo_light !== undefined ? { logoLight: previews.logo_light } : {}),
        ...(previews.logo_dark !== undefined ? { logoDark: previews.logo_dark } : {}),
        ...(previews.favicon !== undefined ? { favicon: previews.favicon } : {})
      });
      toast.success(t('branding.saved'));
    } catch {
      toast.error(t('branding.saveFailed'));
    }
  };

  const slotLabel: Record<SlotKey, string> = {
    logo_light: t('branding.logoLight'),
    logo_dark: t('branding.logoDark'),
    favicon: t('branding.favicon')
  };
  const slotHint: Record<SlotKey, string> = {
    logo_light: t('branding.logoHint'),
    logo_dark: t('branding.logoHint'),
    favicon: t('branding.faviconHint')
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Icons.logo className='h-5 w-5' />
          {t('branding.title')}
        </CardTitle>
        <CardDescription>{t('branding.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='bg-muted h-24 animate-pulse rounded-md' />
            <div className='bg-muted h-24 animate-pulse rounded-md' />
            <div className='bg-muted h-24 animate-pulse rounded-md' />
          </div>
        ) : isError ? (
          <p className='text-destructive text-sm'>{t('branding.loadFailed')}</p>
        ) : (
          <div className='flex flex-col gap-5'>
            <div className='grid gap-4 sm:grid-cols-3'>
              {SLOTS.map((key) => (
                <div key={key} className='flex flex-col gap-2'>
                  <Label htmlFor={`branding-${key}`}>{slotLabel[key]}</Label>
                  <button
                    type='button'
                    aria-label={slotLabel[key]}
                    onClick={() => inputRefs.current[key]?.click()}
                    className='bg-muted hover:bg-muted/70 flex h-24 items-center justify-center overflow-hidden rounded-md border border-dashed'
                  >
                    {previews[key] ? (
                      <img
                        src={previews[key]}
                        alt={slotLabel[key]}
                        className='max-h-20 max-w-full'
                      />
                    ) : (
                      <Icons.upload className='text-muted-foreground h-5 w-5' />
                    )}
                  </button>
                  <input
                    id={`branding-${key}`}
                    ref={(el) => {
                      inputRefs.current[key] = el;
                    }}
                    type='file'
                    accept='image/png'
                    className='hidden'
                    onChange={(e) => handleFile(key, e.target.files?.[0])}
                  />
                  <p className='text-muted-foreground text-xs'>{slotHint[key]}</p>
                </div>
              ))}
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='branding-name'>{t('branding.companyNameRequired')}</Label>
                <Input
                  id='branding-name'
                  value={profile.name}
                  maxLength={100}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='branding-address'>{t('branding.companyAddress')}</Label>
                <Input
                  id='branding-address'
                  value={profile.address}
                  maxLength={255}
                  onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='branding-email'>{t('branding.companyEmail')}</Label>
                <Input
                  id='branding-email'
                  type='email'
                  value={profile.email}
                  maxLength={100}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='branding-phone'>{t('branding.companyPhone')}</Label>
                <Input
                  id='branding-phone'
                  value={profile.phone}
                  maxLength={30}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className='flex justify-end pt-1'>
              <Button onClick={save} disabled={update.isPending}>
                {update.isPending && <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />}
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
