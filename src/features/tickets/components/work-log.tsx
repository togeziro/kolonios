import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import type { WorkLogEntryInput } from '../api/types';
import { SelfieCapture } from '@/features/attendance/components/selfie-capture';
import { PHOTO_UPLOAD_FAILED, uploadTicketPhoto } from '@/lib/storage/upload-client';
import { getCurrentLocation } from '@/features/attendance/utils/geolocation';

export default function WorkLog({
  entries,
  onChange,
  disabled
}: {
  entries: WorkLogEntryInput[];
  onChange: (next: WorkLogEntryInput[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const [note, setNote] = useState('');
  const [meter, setMeter] = useState('');
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [locPending, setLocPending] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);

  const addEntry = (entry: WorkLogEntryInput) => onChange([...entriesRef.current, entry]);

  const addNote = () => {
    const body = note.trim();
    if (!body) return;
    addEntry({ kind: 'note', body });
    setNote('');
  };

  const addLocation = async () => {
    setLocPending(true);
    try {
      const res = await getCurrentLocation();
      if (res.status !== 'success') {
        toast.error(t('workSession.logLocationFailed'));
        return;
      }
      const { latitude, longitude } = res.location;
      addEntry({ kind: 'location', body: `${latitude},${longitude}` });
    } finally {
      setLocPending(false);
    }
  };

  const addMeter = () => {
    const body = meter.trim();
    if (!body) return;
    addEntry({ kind: 'meter', body });
    setMeter('');
  };

  const capturePhoto = (dataUrl: string) => {
    setPhotoKey(null);
    setPhotoPending(true);
    uploadTicketPhoto(dataUrl, Date.now())
      .then((key) => {
        setPhotoKey(key);
        addEntry({ kind: 'photo', body: key });
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.message === PHOTO_UPLOAD_FAILED) {
          toast.error(t('workSession.logPhotoFailed'));
        }
      })
      .finally(() => setPhotoPending(false));
  };

  return (
    <Card className='space-y-3 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
      <div className='flex items-center justify-between'>
        <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
          {t('workSession.logTitle')}
        </p>
        <span className='text-xs text-muted-foreground'>{entries.length}</span>
      </div>

      <ul className='space-y-2'>
        {entries.map((entry, i) => (
          <li key={`${entry.kind}-${i}`} className='flex items-start gap-2 text-sm'>
            {entry.kind === 'note' && (
              <Icons.post className='mt-0.5 size-4 text-muted-foreground' />
            )}
            {entry.kind === 'location' && (
              <Icons.location className='mt-0.5 size-4 text-muted-foreground' />
            )}
            {entry.kind === 'meter' && (
              <Icons.adjustments className='mt-0.5 size-4 text-muted-foreground' />
            )}
            {entry.kind === 'photo' && (
              <Icons.media className='mt-0.5 size-4 text-muted-foreground' />
            )}
            <span className='dark:text-zinc-200'>
              {entry.kind === 'location'
                ? `${t('workSession.logLocationLabel')} ${entry.body}`
                : entry.body}
            </span>
          </li>
        ))}
      </ul>

      <div className='space-y-2'>
        <div className='flex items-center gap-2'>
          <Input
            value={note}
            placeholder={t('workSession.logNotePlaceholder')}
            disabled={disabled}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNote();
            }}
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled || !note.trim()}
            onClick={addNote}
          >
            <Icons.add className='mr-1 size-4' />
            {t('workSession.logAddNote')}
          </Button>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex overflow-hidden rounded-xl border dark:border-zinc-800/50'>
            <SelfieCapture
              required={false}
              disabled={disabled || photoPending}
              captureLabel={t('workSession.logAddPhoto')}
              captureNowLabel={t('workSession.capturePhoto')}
              retakeLabel={t('workSession.retake')}
              onCapture={capturePhoto}
              onClear={() => undefined}
            />
            {photoKey && <Icons.check className='size-4 self-center text-green-500' />}
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled || locPending}
            onClick={addLocation}
          >
            <Icons.location className='mr-1 size-4' />
            {t('workSession.logAddLocation')}
          </Button>
          <Input
            value={meter}
            placeholder={t('workSession.logMeterPlaceholder')}
            disabled={disabled}
            className='w-28'
            onChange={(e) => setMeter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMeter();
            }}
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled || !meter.trim()}
            onClick={addMeter}
          >
            {t('workSession.logAddMeter')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
