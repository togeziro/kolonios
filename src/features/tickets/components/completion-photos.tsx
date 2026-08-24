import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';
import { SelfieCapture } from '@/features/attendance/components/selfie-capture';
import { PHOTO_UPLOAD_FAILED, uploadTicketPhoto } from '@/lib/storage/upload-client';
import { toast } from 'sonner';

const SLOT_COUNT = 2;

type PhotoSlot = { key: string | null; dataUrl: string | null };

function emptySlots(count: number): PhotoSlot[] {
  return Array.from({ length: count }, () => ({ key: null, dataUrl: null }));
}

// Module scope so the impure `Date.now()` id generation never appears to run
// during render — this only executes from the capture event flow.
function uploadSlotPhoto(
  index: number,
  dataUrl: string,
  onKey: (key: string) => void,
  onError: () => void
) {
  const photoId = Date.now() + index;
  uploadTicketPhoto(dataUrl, photoId)
    .then(onKey)
    .catch((e: unknown) => {
      if (e instanceof Error && e.message === PHOTO_UPLOAD_FAILED) {
        onError();
      }
    });
}

export default function CompletionPhotos({
  photos,
  onChange,
  disabled
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [slots, setSlots] = useState<PhotoSlot[]>(() => {
    const base = emptySlots(SLOT_COUNT);
    photos.forEach((key, i) => {
      if (i < SLOT_COUNT) base[i] = { key, dataUrl: null };
    });
    return base;
  });

  const updateSlot = (index: number, patch: Partial<PhotoSlot>) => {
    setSlots((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
      onChange(next.map((s) => s.key).filter((k): k is string => k !== null));
      return next;
    });
  };

  const capture = (index: number, dataUrl: string) => {
    updateSlot(index, { dataUrl });
    uploadSlotPhoto(
      index,
      dataUrl,
      (key) => updateSlot(index, { key }),
      () => toast.error(t('workSession.photoUploadFailed'))
    );
  };

  const clear = (index: number) => {
    updateSlot(index, { key: null, dataUrl: null });
  };

  return (
    <div className='space-y-3'>
      <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
        {t('workSession.completionPhotos')}
      </p>
      <div className='grid grid-cols-2 gap-3'>
        {slots.map((slot, i) => (
          <div key={i} className='space-y-2 rounded-xl border p-3 dark:border-zinc-800/50'>
            {slot.dataUrl ? (
              <img
                src={slot.dataUrl}
                alt={`${t('workSession.completionPhotos')} ${i + 1}`}
                className='h-32 w-full rounded-lg border object-cover'
              />
            ) : (
              <div className='flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground'>
                <Icons.media className='size-6' />
              </div>
            )}
            <SelfieCapture
              required={false}
              disabled={disabled}
              captureLabel={`${t('workSession.addPhoto')} ${i + 1}`}
              captureNowLabel={t('workSession.capturePhoto')}
              retakeLabel={t('workSession.retake')}
              onCapture={(dataUrl) => capture(i, dataUrl)}
              onClear={() => clear(i)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
