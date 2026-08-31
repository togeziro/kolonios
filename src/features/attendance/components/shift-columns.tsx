import type { ColumnDef } from '@tanstack/react-table';
import type { AppFeatures } from '@/lib/table-features';
import { MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import { findShiftColorPreset } from '../lib/shift-colors';

export interface ShiftListRow {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  color: string | null;
  late_tolerance_minutes: number;
  status: 'active' | 'inactive' | null;
  used: boolean;
}

export interface ShiftColumnCallbacks {
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

const EN_DASH = '\u2013'; // –

export function buildShiftColumns({
  onEdit,
  onDelete
}: ShiftColumnCallbacks): ColumnDef<AppFeatures, ShiftListRow>[] {
  return [
    {
      id: 'search',
      accessorFn: (row) => row.name,
      filterFn: 'includesString',
      enableHiding: true
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Shift',
      size: 240,
      minSize: 200,
      cell: ({ row }) => (
        <div className='flex items-center gap-2 text-sm'>
          <ColorSwatch hex={row.original.color} />
          <span className='font-medium'>{row.original.name}</span>
        </div>
      )
    },
    {
      id: 'hours',
      accessorKey: 'start_time',
      header: 'Hours',
      size: 140,
      cell: ({ row }) => (
        <span className='text-sm'>
          {row.original.start_time}
          {EN_DASH}
          {row.original.end_time}
        </span>
      )
    },
    {
      id: 'break',
      accessorKey: 'break_start',
      header: 'Break',
      size: 140,
      cell: ({ row }) => <BreakCell shift={row.original} />
    },
    {
      id: 'tolerance',
      accessorKey: 'late_tolerance_minutes',
      header: 'Late tolerance',
      size: 110,
      cell: ({ row }) => <ToleranceCell minutes={row.original.late_tolerance_minutes} />
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      size: 110,
      filterFn: (row, _columnId, filterValue) => {
        if (!filterValue || filterValue === 'All') return true;
        if (filterValue === 'Active') return row.original.status === 'active';
        if (filterValue === 'Inactive') return row.original.status === 'inactive';
        return true;
      },
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    },
    {
      id: 'actions',
      header: '',
      size: 70,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <ShiftActionsCell shiftId={row.original.id} onEdit={onEdit} onDelete={onDelete} />
      )
    }
  ];
}

function BreakCell({ shift }: { shift: ShiftListRow }) {
  const { t } = useTranslation();
  if (!shift.break_start || !shift.break_end) {
    return (
      <span className='text-muted-foreground text-sm'>{t('attendanceAdmin.shiftBreakNone')}</span>
    );
  }
  return (
    <span className='text-sm'>
      {shift.break_start}
      {EN_DASH}
      {shift.break_end}
    </span>
  );
}

function ToleranceCell({ minutes }: { minutes: number }) {
  const { t } = useTranslation();
  return (
    <span className='text-sm'>
      {minutes} {t('attendanceAdmin.shiftMinutesLabel')}
    </span>
  );
}

function ShiftActionsCell({
  shiftId,
  onEdit,
  onDelete
}: {
  shiftId: number;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' aria-label={t('attendanceAdmin.actionsMenu')}>
          <MoreVertical className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-40' align='end'>
        <DropdownMenuItem onSelect={() => onEdit(shiftId)}>
          {t('attendanceAdmin.editShift')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDelete(shiftId)} variant='destructive'>
          {t('attendanceAdmin.deleteShift')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColorSwatch({ hex }: { hex: string | null }) {
  const preset = findShiftColorPreset(hex);
  if (!preset) {
    return (
      <span
        aria-hidden
        className='bg-muted inline-block h-3 w-3 rounded-full border border-dashed border-muted-foreground/40'
      />
    );
  }
  return (
    <span
      aria-hidden
      className='inline-block h-3 w-3 rounded-full'
      style={{ background: preset.hex }}
    />
  );
}

function StatusBadge({ status }: { status: 'active' | 'inactive' | null }) {
  const { t } = useTranslation();
  if (status === 'inactive') {
    return (
      <Badge variant='outline' className='bg-slate-100 text-slate-700 dark:bg-slate-500/20'>
        {t('attendanceAdmin.shiftsStatusInactive')}
      </Badge>
    );
  }
  return (
    <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20'>
      {t('attendanceAdmin.shiftsStatusActive')}
    </Badge>
  );
}
