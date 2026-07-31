import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { performanceStatsQueryOptions } from '../api/queries';

export default function PerformanceSnapshot() {
  const { data } = useQuery(performanceStatsQueryOptions());
  const reports = data?.reports ?? [];
  if (reports.length === 0) return null;

  const latest = reports[reports.length - 1];
  return (
    <div className='px-4'>
      <Card className='rounded-2xl p-4'>
        <p className='text-muted-foreground text-[11px] font-medium uppercase'>Your performance</p>
        <p className='mt-1 text-lg font-semibold tabular-nums'>{latest.score ?? '—'}%</p>
        <p className='text-muted-foreground text-xs'>{latest.date}</p>
      </Card>
    </div>
  );
}
