import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ScheduleGridResponse, ScheduleGridRow as GridRow } from '../api/types';
import { buildRowHeaderAriaLabel } from '../utils/aria';
import { WEEKEND_DAYS } from '../utils/constants';
import { dayOfWeek, weekDays } from '../utils/date-utils';
import { GridCell } from './grid-cell';
import { GridRowHeader } from './grid-row-header';

export type ScheduleGridProps = {
  response: ScheduleGridResponse;
  /** Optional minimum loading height to avoid layout shifts. */
  skeleton?: boolean;
  /**
   * Ticket 03: invoked when a row-header "+ Assign Shift" CTA is clicked.
   * Only rows with `row.hasAssignment === false` will surface the CTA.
   */
  onAssignShift?: (row: GridRow) => void;
  /**
   * Business-timezone "today" (YYYY-MM-DD). When set, the matching day
   * column header is highlighted (Kerjoo `table-success` parity) and
   * annotated with `aria-current="date"`.
   */
  today?: string;
};

/**
 * The read-only weekly grid. Renders one row per employee × seven cells
 * for the week starting at `response.weekStart`. The employee column is
 * sticky; the rest can scroll horizontally on narrow viewports.
 *
 * Column headers include a 🇮🇩 holiday badge when a date lands on a
 * national holiday (or a recurring holiday whose MM-DD falls on that
 * date within the current year).
 */
export function ScheduleGrid({
  response,
  skeleton = false,
  onAssignShift,
  today
}: ScheduleGridProps) {
  const { t } = useTranslation();
  const days = weekDays(response.weekStart);

  return (
    <div className='overflow-x-auto rounded-md border'>
      <div role='grid' aria-label={t('scheduleGrid.gridAria')} className='min-w-[64rem]'>
        <ScheduleGridHeader days={days} holidayByDate={response.holidays.byDate} today={today} />
        {response.rows.length === 0
          ? null
          : response.rows.map((row) => (
              <ScheduleGridBodyRow
                key={row.userId}
                row={row}
                days={days}
                weekStart={response.weekStart}
                skeleton={skeleton}
                onAssignShift={onAssignShift}
              />
            ))}
      </div>
    </div>
  );
}

function ScheduleGridHeader({
  days,
  holidayByDate,
  today
}: {
  days: string[];
  holidayByDate: Record<string, string>;
  today?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role='row' className='sticky top-0 z-20 grid border-b bg-background' style={gridColsStyle}>
      <div
        role='columnheader'
        className={cn(
          'flex items-center border-r px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'
        )}
      >
        {t('scheduleGrid.grid.employee')}
      </div>
      {days.map((date) => {
        const dow = dayOfWeek(date);
        const isWeekend = WEEKEND_DAYS.includes(dow as (typeof WEEKEND_DAYS)[number]);
        const holiday = holidayByDate[date] ?? null;
        const isToday = date === today;
        const label = formatColumnLabel(date, t);
        return (
          <div
            key={date}
            role='columnheader'
            aria-current={isToday ? 'date' : undefined}
            className={cn(
              'flex flex-col items-center justify-center border-r px-2 py-1 text-center',
              isWeekend && 'bg-muted/40',
              // `table-success` is an inert Kerjoo-parity marker (Bootstrap
              // class); the real highlight comes from bg-success/border-success.
              isToday && 'table-success border-success bg-success/10 text-success-foreground'
            )}
            title={holiday ?? undefined}
            aria-label={
              holiday ? `${label} ${t('scheduleGrid.cell.placeholder')} ${holiday}` : label
            }
          >
            {holiday ? (
              <span className='text-[10px]' aria-hidden>
                {t('scheduleGrid.holiday.flag')}
                <span className='ml-1 line-clamp-1 text-[10px] font-medium text-rose-600 dark:text-rose-300'>
                  {holiday}
                </span>
              </span>
            ) : null}
            <span className='text-[11px] font-semibold text-muted-foreground'>{label}</span>
            <span className='text-xs font-medium tabular-nums'>{date.slice(8, 10)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleGridBodyRow({
  row,
  days,
  weekStart,
  skeleton,
  onAssignShift
}: {
  row: GridRow;
  days: string[];
  weekStart: string;
  skeleton: boolean;
  onAssignShift?: (row: GridRow) => void;
}) {
  const { t } = useTranslation();
  const rowAriaLabel = buildRowHeaderAriaLabel(row);
  return (
    <div
      role='row'
      aria-label={rowAriaLabel}
      className='grid border-b last:border-b-0'
      style={gridColsStyle}
    >
      <GridRowHeader row={row} onAssignShift={onAssignShift} />
      {days.map((date) => {
        const cell = row.cells.find((c) => c.date === date);
        if (!cell) {
          return (
            <div key={date} role='gridcell' className='border-r p-1'>
              <div
                className={cn(
                  'flex h-full min-h-[3.25rem] items-center justify-center rounded-md border border-dashed text-muted-foreground',
                  skeleton && 'animate-pulse'
                )}
              >
                {t('scheduleGrid.cell.placeholder')}
              </div>
            </div>
          );
        }
        return (
          <div key={date} role='gridcell' className='border-r p-1'>
            <GridCell employeeId={row.userId} cell={cell} weekStart={weekStart} />
          </div>
        );
      })}
    </div>
  );
}

const gridColsStyle = { gridTemplateColumns: `minmax(14rem, 1.4fr) repeat(7, minmax(8rem, 1fr))` };

function formatColumnLabel(date: string, t: (key: string) => string): string {
  const dow = dayOfWeek(date);
  switch (dow) {
    case 0:
      return t('attendance.weekSun');
    case 1:
      return t('attendance.weekMon');
    case 2:
      return t('attendance.weekTue');
    case 3:
      return t('attendance.weekWed');
    case 4:
      return t('attendance.weekThu');
    case 5:
      return t('attendance.weekFri');
    case 6:
      return t('attendance.weekSat');
    default:
      return '';
  }
}
