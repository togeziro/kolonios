import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useDebounce } from '@/hooks/use-debounce';
import { businessDateInTimeZone } from '@/lib/dates';
import { departmentsQueryOptions } from '@/features/masterdata/api/queries';
import { scheduleGridQueryOptions } from '../api/queries';
import { exportMonthFn } from '../api/export-service';
import type { ScheduleGridFilters, ScheduleGridRow } from '../api/types';
import { AssignShiftDialog } from './assign-shift-dialog';
import { BulkRepeatDialog } from './bulk-repeat-dialog';
import { FilterBar } from './filter-bar';
import { ScheduleGrid } from './schedule-grid';
import { WeekNav } from './week-nav';
import { WeekStartToggle } from './week-start-toggle';
import { useWeekStartPreference } from './use-week-start';
import { SEARCH_DEBOUNCE_MS } from '../utils/constants';
import { addDays, monthOfDate, splitMonthYear, startOfWeek } from '../utils/date-utils';

const EMPTY_FILTERS = {
  month: '',
  weekStart: ''
} as ScheduleGridFilters;

export function ScheduleGridPage() {
  const { t } = useTranslation();
  const [weekStartPref] = useWeekStartPreference();

  // The week-start URL state is owned by the page (not pushed to the route
  // search schema — this is an internal nav state). Filters that are
  // shareable stay in the search schema in a future ticket.
  const today = businessDateInTimeZone(new Date());
  const initialWeekStart = useMemo(() => startOfWeek(today, weekStartPref), [today, weekStartPref]);

  const [weekStart, setWeekStart] = useState<string>(initialWeekStart);
  const [divisionId, setDivisionId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [assignTarget, setAssignTarget] = useState<ScheduleGridRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState<boolean>(false);

  // Re-anchor the displayed week when the preference flips — but never
  // re-anchor on every render (that would freeze the user's nav).
  useEffect(() => {
    setWeekStart((current) => startOfWeek(current, weekStartPref));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartPref]);

  // Debounce the search input → committed `search` state used by the
  // query key. Reuses the repo's standard `useDebounce` hook (debounce the
  // local string, sync to the query key once the user stops typing).
  const debouncedPendingSearch = useDebounce(pendingSearch, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (debouncedPendingSearch !== search) {
      setSearch(debouncedPendingSearch);
      setPage(1);
    }
  }, [debouncedPendingSearch, search]);

  const filters: ScheduleGridFilters = {
    month: monthOfDate(weekStart),
    weekStart,
    divisionId,
    query: search.length > 0 ? search : null,
    page,
    pageSize
  };
  const { year: pickerYear, month: pickerMonth } = splitMonthYear(filters.month);

  const { data: divisionsResult } = useQuery(departmentsQueryOptions());
  const divisions = useMemo(() => {
    const rows = divisionsResult?.departments ?? [];
    return rows.filter((d) => d.is_active !== false).map((d) => ({ id: d.id, name: d.name }));
  }, [divisionsResult]);

  const { data, isPending, isError } = useQuery({
    ...scheduleGridQueryOptions(filters),
    placeholderData: (previous) => previous
  });

  const handlePrev = useCallback(() => {
    setWeekStart((current) => addDays(current, -7));
    setPage(1);
  }, []);

  const handleNext = useCallback(() => {
    setWeekStart((current) => addDays(current, 7));
    setPage(1);
  }, []);

  const handleToday = useCallback(() => {
    setWeekStart(startOfWeek(today, weekStartPref));
    setPage(1);
  }, [today, weekStartPref]);

  const handlePickDate = useCallback(
    (date: string) => {
      setWeekStart(startOfWeek(date, weekStartPref));
      setPage(1);
    },
    [weekStartPref]
  );

  const handleDivisionChange = useCallback((next: string | null) => {
    setDivisionId(next);
    setPage(1);
  }, []);

  const exportMutation = useMutation({
    mutationFn: () =>
      exportMonthFn({
        data: {
          month: filters.month,
          divisionId,
          query: search.length > 0 ? search : null
        }
      }),
    onSuccess: (res) => {
      if (!res?.success || !res.base64) {
        toast.error(t('scheduleGrid.export.failed'));
        return;
      }
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: res.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('scheduleGrid.export.success'));
    },
    onError: () => toast.error(t('scheduleGrid.export.failed'))
  });

  const weekEnd = data?.weekEnd ?? addDays(weekStart, 6);
  const isCurrentWeek = today >= weekStart && today <= weekEnd;
  const rowCount = data?.rows.length ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className='col-sm-12 space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <CardTitle>{t('scheduleGrid.title')}</CardTitle>
              <CardDescription>{t('scheduleGrid.description')}</CardDescription>
            </div>
            <WeekStartToggle />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <FilterBar
            divisions={divisions}
            divisionId={divisionId}
            onDivisionChange={handleDivisionChange}
            search={search}
            pendingSearch={pendingSearch}
            onPendingSearchChange={setPendingSearch}
            isPending={isPending}
          />
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              data-testid='schedule-grid-bulk'
              onClick={() => setBulkOpen(true)}
            >
              <Icons.copy className='mr-1 size-3.5' />
              {t('scheduleGrid.actions.bulk')}
            </Button>
            <Button variant='outline' size='sm' disabled data-testid='schedule-grid-import'>
              <Icons.download className='mr-1 size-3.5' />
              {t('scheduleGrid.actions.import')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              data-testid='schedule-grid-export'
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              <Icons.upload className='mr-1 size-3.5' />
              {t('scheduleGrid.actions.export')}
            </Button>
          </div>
          <WeekNav
            weekStart={weekStart}
            weekEnd={weekEnd}
            month={pickerMonth}
            year={pickerYear}
            onPrev={handlePrev}
            onToday={handleToday}
            onNext={handleNext}
            onPickDate={handlePickDate}
            isCurrentWeek={isCurrentWeek}
          />

          {isError ? (
            <p className='text-sm text-muted-foreground'>{t('scheduleGrid.loadError')}</p>
          ) : isPending && !data ? (
            <ScheduleGrid
              response={{
                ...EMPTY_FILTERS,
                month: filters.month,
                weekStart: filters.weekStart,
                weekEnd: addDays(filters.weekStart, 6),
                rows: [],
                total: 0,
                page: filters.page ?? 1,
                pageSize,
                holidays: { byDate: {} }
              }}
              skeleton
              today={today}
            />
          ) : data && rowCount === 0 ? (
            <EmptyState
              onResetFilters={() => {
                setDivisionId(null);
                setSearch('');
                setPendingSearch('');
                setPage(1);
              }}
            />
          ) : data ? (
            <ScheduleGrid response={data} onAssignShift={setAssignTarget} today={today} />
          ) : null}

          {data ? (
            <Pagination total={total} page={page} pageSize={pageSize} onPageChange={setPage} />
          ) : null}
        </CardContent>
      </Card>

      <AssignShiftDialog
        open={assignTarget != null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
        userId={assignTarget?.userId ?? null}
        userName={assignTarget?.fullName}
      />

      <BulkRepeatDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        sourceWeekStart={weekStart}
        divisionId={divisionId}
        query={search.length > 0 ? search : null}
        totalEmployees={total}
      />
    </div>
  );
}

function EmptyState({ onResetFilters }: { onResetFilters: () => void }) {
  const { t } = useTranslation();
  return (
    <div className='flex flex-col items-center justify-center gap-14 rounded-md border border-dashed p-8 text-center'>
      <p className='text-sm text-muted-foreground'>{t('scheduleGrid.empty.message')}</p>
      <Button variant='outline' size='sm' onClick={onResetFilters}>
        {t('scheduleGrid.empty.reset')}
      </Button>
    </div>
  );
}

function Pagination({
  total,
  page,
  pageSize,
  onPageChange
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (next: number) => void;
}) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) {
    return (
      <div className='flex justify-end text-xs text-muted-foreground'>
        {t('scheduleGrid.pagination.total', { count: total })}
      </div>
    );
  }
  return (
    <div className='flex items-center justify-between gap-2 text-xs'>
      <span className='text-muted-foreground'>
        {t('scheduleGrid.pagination.total', { count: total })}
      </span>
      <div className='flex items-center gap-1'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          {t('scheduleGrid.pagination.prev')}
        </Button>
        <span className='px-2 tabular-nums text-muted-foreground'>
          {page} {t('scheduleGrid.nav.pageSeparator')} {pageCount}
        </span>
        <Button
          variant='outline'
          size='sm'
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
        >
          {t('scheduleGrid.pagination.next')}
        </Button>
      </div>
    </div>
  );
}
