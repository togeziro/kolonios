import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Building2, UserCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import {
  useAppendCareerEvent,
  type AppendCareerEventPayload
} from '@/features/employees/api/career-events';
import { EMPLOYMENT_STATUS_OPTIONS } from '@/features/employees/components/employee-tables/options';
import {
  departmentsQueryOptions,
  designationOptionsQueryOptions
} from '@/features/masterdata/api/queries';
import { useSuspenseQuery } from '@tanstack/react-query';
import { businessDateInTimeZone, ISO_DATE_REGEX } from '@/lib/dates';

export type CareerEventDialogCategory = 'position' | 'division' | 'employment_status';

export interface CareerEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  category: CareerEventDialogCategory;
}

const CATEGORY_ICONS = {
  position: Briefcase,
  division: Building2,
  employment_status: UserCheck
} as const;

function todayISO(): string {
  return businessDateInTimeZone(new Date());
}

function validatePayload(payload: AppendCareerEventPayload): string | null {
  if (!ISO_DATE_REGEX.test(payload.effectiveDate)) {
    return 'effectiveDateRequired';
  }
  if (
    payload.category === 'position' &&
    (!payload.toDesignationId || payload.toDesignationId <= 0)
  ) {
    return 'toDesignationRequired';
  }
  if (payload.category === 'division' && (!payload.toDepartmentId || payload.toDepartmentId <= 0)) {
    return 'toDepartmentRequired';
  }
  if (payload.category === 'employment_status' && !payload.toLabel) {
    return 'toEmploymentStatusRequired';
  }
  return null;
}

/**
 * Shared dialog for the three Change buttons on the Career Timeline header
 * (Change Division / Change Position / Change Work Status). The visible
 * fields vary by `category`:
 *
 *   position         → designation picker
 *   division         → department picker
 *   employment_status → employment-status select
 *
 * All three show the effective-date picker + notes textarea. Submit calls
 * `appendCareerEventFn` (employees.edit guard) and the timeline query is
 * invalidated by the `useAppendCareerEvent` hook.
 */
export function CareerEventDialog({
  open,
  onOpenChange,
  employeeId,
  category
}: CareerEventDialogProps) {
  const { t } = useTranslation();
  const [effectiveDate, setEffectiveDate] = useState(todayISO);
  const [notes, setNotes] = useState('');
  const [designationPick, setDesignationPick] = useState('');
  const [departmentPick, setDepartmentPick] = useState('');
  const [employmentStatusPick, setEmploymentStatusPick] = useState('active');

  // Reset the draft every time the dialog opens (or re-opens with a new
  // category). Adjust-state-during-render pattern — same approach used in
  // the payroll override dialog.
  const [prevOpen, setPrevOpen] = useState<{ open: boolean; category: string } | null>(null);
  if (!prevOpen || prevOpen.open !== open || prevOpen.category !== category) {
    setPrevOpen({ open, category });
    if (open) {
      setEffectiveDate(todayISO());
      setNotes('');
      setDesignationPick('');
      setDepartmentPick('');
      setEmploymentStatusPick('active');
    }
  }

  const { data: deptData } = useSuspenseQuery(departmentsQueryOptions());
  const { data: desigData } = useSuspenseQuery(designationOptionsQueryOptions());

  const departments = deptData?.departments ?? [];
  const designationOptions = desigData?.options ?? [];

  const append = useAppendCareerEvent(employeeId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedNotes = notes.trim().length > 0 ? notes.trim() : null;

    let payload: AppendCareerEventPayload;
    if (category === 'position') {
      const n = Number(designationPick);
      if (!Number.isFinite(n) || n <= 0) return;
      payload = {
        category: 'position',
        employeeId,
        toDesignationId: n,
        effectiveDate,
        notes: trimmedNotes
      };
    } else if (category === 'division') {
      const n = Number(departmentPick);
      if (!Number.isFinite(n) || n <= 0) return;
      payload = {
        category: 'division',
        employeeId,
        toDepartmentId: n,
        effectiveDate,
        notes: trimmedNotes
      };
    } else {
      payload = {
        category: 'employment_status',
        employeeId,
        toLabel: employmentStatusPick as 'active' | 'probation' | 'resigned' | 'terminated',
        effectiveDate,
        notes: trimmedNotes
      };
    }

    const errKey = validatePayload(payload);
    if (errKey) {
      toast.error(t(`employee.careerTimeline.append.${errKey}`));
      return;
    }

    try {
      await append.mutateAsync(payload);
      toast.success(t('employee.careerTimeline.append.submitSuccess'));
      onOpenChange(false);
    } catch {
      toast.error(t('employee.careerTimeline.append.submitFailed'));
    }
  };

  const Icon = CATEGORY_ICONS[category];
  const titleKey = `employee.careerTimeline.append.${category}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]' data-testid={`career-event-dialog-${category}`}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Icon className='text-muted-foreground h-4 w-4' aria-hidden='true' />
            {t(titleKey)}
          </DialogTitle>
          <DialogDescription>{t('employee.careerTimeline.append.description')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className='flex flex-col gap-4'
          data-testid='career-event-form'
        >
          <div className='flex flex-col gap-2'>
            <Label htmlFor='career-event-effective-date'>
              {t('employee.careerTimeline.append.effectiveDate')}
            </Label>
            <Input
              id='career-event-effective-date'
              type='date'
              value={effectiveDate}
              max='9999-12-31'
              onChange={(event) => setEffectiveDate(event.target.value)}
              required
              data-testid='career-event-effective-date'
            />
            <p className='text-muted-foreground text-xs'>
              {t('employee.careerTimeline.append.effectiveDateHelp')}
            </p>
          </div>

          {category === 'position' && (
            <div className='flex flex-col gap-2'>
              <Label htmlFor='career-event-to-designation'>
                {t('employee.careerTimeline.append.toDesignation')}
              </Label>
              <NativeSelect
                id='career-event-to-designation'
                value={designationPick}
                onChange={(event) => setDesignationPick(event.target.value)}
                required
                data-testid='career-event-to-designation'
              >
                <option value='' disabled>
                  {t('employee.careerTimeline.append.toDesignationRequired')}
                </option>
                {designationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          {category === 'division' && (
            <div className='flex flex-col gap-2'>
              <Label htmlFor='career-event-to-department'>
                {t('employee.careerTimeline.append.toDepartment')}
              </Label>
              <NativeSelect
                id='career-event-to-department'
                value={departmentPick}
                onChange={(event) => setDepartmentPick(event.target.value)}
                required
                data-testid='career-event-to-department'
              >
                <option value='' disabled>
                  {t('employee.careerTimeline.append.toDepartmentRequired')}
                </option>
                {departments.map((dept: { id: number; name: string }) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          {category === 'employment_status' && (
            <div className='flex flex-col gap-2'>
              <Label htmlFor='career-event-to-employment-status'>
                {t('employee.careerTimeline.append.toEmploymentStatus')}
              </Label>
              <NativeSelect
                id='career-event-to-employment-status'
                value={employmentStatusPick}
                onChange={(event) => setEmploymentStatusPick(event.target.value)}
                required
                data-testid='career-event-to-employment-status'
              >
                {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className='flex flex-col gap-2'>
            <Label htmlFor='career-event-notes'>{t('employee.careerTimeline.append.notes')}</Label>
            <Textarea
              id='career-event-notes'
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('employee.careerTimeline.append.notesPlaceholder')}
              rows={3}
              data-testid='career-event-notes'
            />
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={append.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type='submit' disabled={append.isPending} data-testid='career-event-submit'>
              {append.isPending && <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />}
              {append.isPending
                ? t('employee.careerTimeline.append.submitting')
                : t('employee.careerTimeline.append.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
