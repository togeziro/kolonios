import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '@/components/icons';
import { SelfieCapture } from '@/features/attendance/components/selfie-capture';
import { uploadTicketPhoto } from '@/lib/storage/upload-client';
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
  onError: (message: string) => void
) {
  const photoId = Date.now() + index;
  uploadTicketPhoto(dataUrl, photoId)
    .then(onKey)
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      // Previously only PHOTO_UPLOAD_FAILED triggered toast — "Storage is not configured"
      // and other S3 errors were swallowed, leaving slots in dataUrl-only state and
      // Finish & Submit permanently disabled. Surface every failure.
      onError(message);
    });
}

export default function CompletionPhotos({
  onChange,
  disabled
}: {
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  // Slot state is fully internal — the parent only needs the list of uploaded keys.
  // Earlier versions read `photos` from props at init AND inside setState updaters,
  // which caused "Cannot update a component while rendering a different one" because
  // the parent's setPhotos fired during CompletionPhotos' render.
  const [slots, setSlots] = useState<PhotoSlot[]>(() => emptySlots(SLOT_COUNT));

  const publishKeys = (next: PhotoSlot[]) => {
    onChange(next.map((s) => s.key).filter((k): k is string => k !== null));
  };

  const capture = (index: number, dataUrl: string) => {
    // Update local slot state first (preview), then fire upload. Both setters run
    // outside of any setState updater so we don't update the parent during render.
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, dataUrl } : s)));
    uploadSlotPhoto(
      index,
      dataUrl,
      (key) => {
        setSlots((prev) => {
          const next = prev.map((s, i) => (i === index ? { ...s, key } : s));
          publishKeys(next);
          return next;
        });
      },
      (message) => {
        const isStorageNotConfigured = message === 'Storage is not configured';
        toast.error(
          isStorageNotConfigured
            ? t('workSession.photoUploadFailedStorageNotConfigured')
            : t('workSession.photoUploadFailed')
        );
        // Drop the failed slot's preview so the user can retry cleanly.
        setSlots((prev) => {
          const next = prev.map((s, i) => (i === index ? { key: null, dataUrl: null } : s));
          publishKeys(next);
          return next;
        });
      }
    );
  };

  const clear = (index: number) => {
    setSlots((prev) => {
      const next = prev.map((s, i) => (i === index ? { key: null, dataUrl: null } : s));
      publishKeys(next);
      return next;
    });
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
