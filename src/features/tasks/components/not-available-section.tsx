import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icons } from '@/components/icons';
import { availableTasksQueryOptions } from '../api/queries';

export default function NotAvailableSection() {
  const { t } = useTranslation();
  const { data } = useQuery(availableTasksQueryOptions());
  const unavailable = data?.unavailable ?? [];
  const [open, setOpen] = useState(false);

  if (unavailable.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className='mt-3'>
      <CollapsibleTrigger className='text-muted-foreground flex items-center gap-1 text-xs'>
        <Icons.chevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {t('task.notAvailableCount', { count: unavailable.length })}
      </CollapsibleTrigger>
      <CollapsibleContent className='mt-2 space-y-1.5'>
        {unavailable.slice(0, 3).map((task) => (
          <div key={task.id} className='bg-muted/50 rounded-lg px-3 py-2'>
            <p className='text-xs font-medium'>{task.title}</p>
            <p className='text-muted-foreground text-[11px]'>
              {task.eligibilityReasons.join(' · ')}
            </p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
