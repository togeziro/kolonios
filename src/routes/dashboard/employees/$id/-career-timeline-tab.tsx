import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Building2, UserCheck, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { careerTimelineQueryOptions } from '@/features/employees/api/career-events';
import type { CareerTimelineEvent } from '@/features/employees/api/career-events';
import { sortEventsByEffectiveDateDesc } from '@/lib/career-timeline/engine';
import type { Employee } from '@/features/employees/api/types';
import { CareerTimeline } from './-career-timeline';
import { CareerEventCard } from './-career-event-card';
import { CareerEventDialog, type CareerEventDialogCategory } from './-career-event-dialog';

const ACTION_BUTTONS: ReadonlyArray<{
  key: CareerEventDialogCategory;
  icon: typeof Briefcase;
  labelKey: string;
}> = [
  { key: 'division', icon: Building2, labelKey: 'employee.careerTimeline.changeDivision' },
  { key: 'position', icon: Briefcase, labelKey: 'employee.careerTimeline.changePosition' },
  {
    key: 'employment_status',
    icon: UserCheck,
    labelKey: 'employee.careerTimeline.changeWorkStatus'
  }
];

export function CareerTimelineSubTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery(careerTimelineQueryOptions(employee.id));

  const events: CareerTimelineEvent[] = useMemo(
    () => sortEventsByEffectiveDateDesc(data?.events ?? []),
    [data?.events]
  );
  const lengthOfService = data?.lengthOfService;

  const [activeCategory, setActiveCategory] = useState<CareerEventDialogCategory | null>(null);

  return (
    <div className='flex flex-col gap-4'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Clock className='text-muted-foreground h-4 w-4' />
            {t('employee.careerTimeline.headerTitle')}
          </CardTitle>
          <p className='text-muted-foreground text-xs'>
            {t('employee.careerTimeline.headerSubtitle')}
          </p>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <div
            className='text-foreground text-2xl font-semibold tabular-nums'
            data-testid='career-timeline-length-of-service'
          >
            {lengthOfService ?? t('employee.careerTimeline.headerEmpty')}
          </div>
          <div className='flex flex-wrap gap-2'>
            {ACTION_BUTTONS.map(({ key, icon: Icon, labelKey }) => (
              <Button
                key={key}
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setActiveCategory(key)}
                title={labelKey}
                data-testid={`career-action-${key}`}
              >
                <Icon className='h-4 w-4' />
                {t(labelKey)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeCategory && (
        <CareerEventDialog
          open={activeCategory !== null}
          onOpenChange={(open) => {
            if (!open) setActiveCategory(null);
          }}
          employeeId={employee.id}
          category={activeCategory}
        />
      )}

      {isError ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          {t('employee.notFound')}
        </div>
      ) : isLoading ? (
        <div
          className='text-muted-foreground py-8 text-center text-sm'
          data-testid='career-timeline-loading'
        >
          {t('employee.careerTimeline.loading')}
        </div>
      ) : events.length === 0 ? (
        <div
          className='text-muted-foreground rounded-md border border-dashed py-8 text-center text-sm'
          data-testid='career-timeline-empty'
        >
          {t('employee.careerTimeline.empty')}
        </div>
      ) : (
        <CareerTimeline>
          {events.map((event) => (
            <CareerEventCard key={event.id} event={event} />
          ))}
        </CareerTimeline>
      )}
    </div>
  );
}
