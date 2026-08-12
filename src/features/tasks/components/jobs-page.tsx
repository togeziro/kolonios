import { useTranslation } from 'react-i18next';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Route as JobsRoute } from '@/routes/dashboard/jobs/index';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useTakeTask } from '../api/hooks';
import { availableTasksQueryOptions } from '../api/queries';
import { locationsQueryOptions } from '@/features/attendance/api/queries';
import TaskCard from './task-card';
import type { TaskPriority } from '../api/types';

export default function JobsPage() {
  const { t } = useTranslation();
  const { locationId, priority } = useSearch({ from: JobsRoute.id });
  const navigate = useNavigate();
  const filters = {
    ...(locationId ? { locationId } : {}),
    ...(priority ? { priority: priority as TaskPriority } : {})
  };
  const { data, isLoading } = useQuery(availableTasksQueryOptions(filters));
  const { data: locationsData } = useQuery(locationsQueryOptions());
  const tasks = data?.tasks ?? [];
  const takeTask = useTakeTask();

  function setFilters(next: { locationId?: number; priority?: TaskPriority }) {
    navigate({ to: '/dashboard/jobs', search: next });
  }

  return (
    <div className='space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-semibold'>
          {t('task.availableJobsCount', { count: tasks.length })}
        </h2>
        <button onClick={() => setFilters({})} className='text-muted-foreground text-xs'>
          {t('task.clearFilters')}
        </button>
      </div>
      <div className='flex gap-2'>
        <Select
          value={locationId ? String(locationId) : 'all'}
          onValueChange={(v) =>
            setFilters({
              ...(v === 'all' ? {} : { locationId: Number(v) }),
              ...(priority ? { priority } : {})
            })
          }
        >
          <SelectTrigger className='w-32'>
            <SelectValue placeholder={t('task.location')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('task.allLocations')}</SelectItem>
            {locationsData?.locations.map((loc) => (
              <SelectItem key={loc.id} value={String(loc.id)}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priority ?? 'all'}
          onValueChange={(v) =>
            setFilters({
              ...(locationId ? { locationId } : {}),
              ...(v === 'all' ? {} : { priority: v as TaskPriority })
            })
          }
        >
          <SelectTrigger className='w-28'>
            <SelectValue placeholder={t('task.priority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('task.allPriorities')}</SelectItem>
            <SelectItem value='low'>{t('task.low')}</SelectItem>
            <SelectItem value='medium'>{t('task.medium')}</SelectItem>
            <SelectItem value='high'>{t('task.high')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className='flex justify-center py-8'>
          <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : tasks.length === 0 ? (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          {t('task.noJobsAvailable')}
        </p>
      ) : (
        <div className='space-y-2.5'>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              actionPlacement={'bottom' as const}
              action={
                <Button
                  size='sm'
                  className='w-full'
                  onClick={() => takeTask.mutate(task.id)}
                  disabled={takeTask.isPending}
                >
                  {takeTask.isPending ? t('task.taking') : t('task.takeTask')}
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
