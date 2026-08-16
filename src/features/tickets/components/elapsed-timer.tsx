import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';

export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function ElapsedTimer({
  takenAt,
  className
}: {
  takenAt: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!takenAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [takenAt]);

  const elapsed = takenAt ? Math.max(0, now - new Date(takenAt).getTime()) : 0;

  return (
    <Card
      className={`space-y-1 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900 ${className ?? ''}`}
    >
      <div className='flex items-center gap-2'>
        <span className='h-2 w-2 rounded-full bg-orange-500' />
        <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
          {t('workSession.elapsed')}
        </p>
      </div>
      <p className='font-mono text-3xl font-bold tabular-nums dark:text-white'>
        {formatElapsed(elapsed)}
      </p>
    </Card>
  );
}
