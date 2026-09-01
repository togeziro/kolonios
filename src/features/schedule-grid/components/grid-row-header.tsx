import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ScheduleGridRow as GridRow } from '../api/types';

export type GridRowHeaderProps = {
  row: GridRow;
  /** Sticky to the left of the horizontal scroll container. */
  sticky?: boolean;
};

/**
 * Employee identity column for one row. Sticky on the left so the rest
 * of the row can scroll horizontally on narrow screens while the name
 * stays visible.
 */
export function GridRowHeader({ row, sticky = true }: GridRowHeaderProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex min-h-[3.25rem] items-center gap-2 border-r bg-background px-3 py-2',
        sticky && 'sticky left-0 z-10'
      )}
    >
      <div className='flex min-w-0 flex-col'>
        <span className='truncate text-sm font-medium'>{row.fullName}</span>
        <span className='truncate text-[11px] text-muted-foreground tabular-nums'>
          {row.employeeCode}
          {row.divisionName ? ` · ${row.divisionName}` : ''}
        </span>
      </div>
      {row.activeShiftName ? (
        <span className='ml-auto shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary'>
          {row.activeShiftName}
        </span>
      ) : (
        <span className='ml-auto shrink-0 text-[10px] text-muted-foreground/70'>
          {t('scheduleGrid.rowHeader.noAssignment')}
        </span>
      )}
    </div>
  );
}
