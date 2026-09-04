import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Icons } from '@/components/icons';
import { useRepeatWeekBulk } from '../api/write-mutations';
import { SCHEDULE_GRID_MAX_PAGE_SIZE } from '../api/validation';
import { addDays, formatWeekRangeLabel } from '../utils/date-utils';

export const BULK_REPEAT_MAX_WEEKS = 12;
const BULK_REPEAT_DEFAULT_WEEKS = 4;

export type BulkRepeatDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently displayed week — the repeat source. */
  sourceWeekStart: string;
  /** Active grid filter: the server repeats for every employee matching it. */
  divisionId: string | null;
  query: string | null;
  /** Employees matching the filter (grid `total`); clamped to the server cap. */
  totalEmployees: number;
};

/**
 * "Repeat Schedule in Bulk" dialog (ticket 03, Kerjoo `e42` parity).
 *
 * Copies the displayed week's day offs + shift overrides onto the next N
 * weeks (N = 1..12 via `NativeSelect`, default 4 — Kerjoo's "repeat 4
 * weeks"). The inner body mounts only while the dialog is open, so every
 * open starts from the defaults without a manual reset effect.
 */
export function BulkRepeatDialog({
  open,
  onOpenChange,
  sourceWeekStart,
  divisionId,
  query,
  totalEmployees
}: BulkRepeatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='sm:max-w-[480px]'
        data-testid='bulk-repeat-dialog'
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {open ? (
          <BulkRepeatDialogBody
            key={sourceWeekStart}
            sourceWeekStart={sourceWeekStart}
            divisionId={divisionId}
            query={query}
            totalEmployees={totalEmployees}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BulkRepeatDialogBody({
  sourceWeekStart,
  divisionId,
  query,
  totalEmployees,
  onClose
}: {
  sourceWeekStart: string;
  divisionId: string | null;
  query: string | null;
  totalEmployees: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [weeksCount, setWeeksCount] = useState<number>(BULK_REPEAT_DEFAULT_WEEKS);
  const [includeWeekend, setIncludeWeekend] = useState<boolean>(false);
  const repeatMut = useRepeatWeekBulk();

  const targetWeekStarts = useMemo(() => {
    const out: string[] = [];
    for (let k = 1; k <= weeksCount; k += 1) {
      out.push(addDays(sourceWeekStart, 7 * k));
    }
    return out;
  }, [sourceWeekStart, weeksCount]);

  // The server resolves every employee matching the filter (cap 200), not
  // just the visible page — clamp the same way for an honest summary.
  const users = Math.min(Math.max(0, totalEmployees), SCHEDULE_GRID_MAX_PAGE_SIZE);

  const handleApply = async () => {
    let result: Awaited<ReturnType<typeof repeatMut.mutateAsync>>;
    try {
      result = await repeatMut.mutateAsync({
        sourceWeekStart,
        targetWeekStarts,
        divisionId,
        query,
        includeWeekend
      });
    } catch {
      // Guard / rate-limit / transport failures surface as thrown errors.
      toast.error(t('scheduleGrid.bulk.failed'));
      return;
    }
    if (!result.success) {
      toast.error(t('scheduleGrid.bulk.failed'));
      return;
    }
    if (result.partialFailures.length > 0) {
      toast.warning(
        t('scheduleGrid.bulk.partial', {
          weeks: result.weeksApplied,
          failures: result.partialFailures.length
        })
      );
    } else if (result.weeksApplied === 0) {
      toast.warning(t('scheduleGrid.bulk.noData'));
    } else {
      toast.success(
        t('scheduleGrid.bulk.success', { weeks: result.weeksApplied, users: result.usersAffected })
      );
    }
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('scheduleGrid.bulk.title')}</DialogTitle>
        <DialogDescription>{t('scheduleGrid.bulk.description')}</DialogDescription>
      </DialogHeader>

      <div className='flex flex-col gap-4'>
        <p className='text-xs text-muted-foreground' data-testid='bulk-source-week'>
          {t('scheduleGrid.bulk.sourceWeek', {
            range: formatWeekRangeLabel(sourceWeekStart, addDays(sourceWeekStart, 6))
          })}
        </p>

        <div className='flex flex-col gap-2'>
          <Label htmlFor='bulk-weeks-count'>{t('scheduleGrid.bulk.weeksLabel')}</Label>
          <div className='flex items-center gap-2'>
            <NativeSelect
              id='bulk-weeks-count'
              className='h-9 w-28'
              value={String(weeksCount)}
              onChange={(event) => setWeeksCount(Number(event.target.value))}
              disabled={repeatMut.isPending}
              data-testid='bulk-weeks-select'
            >
              {Array.from({ length: BULK_REPEAT_MAX_WEEKS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </NativeSelect>
            <span className='text-sm text-muted-foreground'>
              {t('scheduleGrid.bulk.weeksUnit')}
            </span>
          </div>
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-sm font-medium'>{t('scheduleGrid.bulk.targetWeeks')}</span>
          <ul className='flex max-h-28 flex-col gap-0.5 overflow-y-auto text-xs text-muted-foreground'>
            {targetWeekStarts.map((weekStart) => (
              <li key={weekStart} data-testid={`bulk-target-week-${weekStart}`}>
                {formatWeekRangeLabel(weekStart, addDays(weekStart, 6))}
              </li>
            ))}
          </ul>
        </div>

        <div className='flex items-start gap-2'>
          <Checkbox
            id='bulk-include-weekend'
            checked={includeWeekend}
            onCheckedChange={(checked) => setIncludeWeekend(checked === true)}
            disabled={repeatMut.isPending}
            data-testid='bulk-include-weekend'
          />
          <div className='flex flex-col gap-0.5'>
            <Label htmlFor='bulk-include-weekend'>{t('scheduleGrid.bulk.includeWeekend')}</Label>
            <p className='text-xs text-muted-foreground'>
              {t('scheduleGrid.bulk.includeWeekendHint')}
            </p>
          </div>
        </div>

        <p className='text-sm font-medium tabular-nums' data-testid='bulk-summary'>
          {t('scheduleGrid.bulk.summary', { users, weeks: weeksCount })}
        </p>
      </div>

      <DialogFooter className='pt-2'>
        <Button type='button' variant='outline' onClick={onClose} disabled={repeatMut.isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          type='button'
          onClick={() => void handleApply()}
          disabled={repeatMut.isPending}
          data-testid='bulk-repeat-apply'
        >
          {repeatMut.isPending ? (
            <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Icons.check className='mr-2 h-4 w-4' />
          )}
          {t('scheduleGrid.bulk.apply')}
        </Button>
      </DialogFooter>
    </>
  );
}
