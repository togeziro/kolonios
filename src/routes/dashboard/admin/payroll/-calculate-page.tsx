/**
 * Unified Payroll Calculate page (Kerjoo-style tabbed UI).
 *
 * Layout mirrors `app.kerjoo.com/#/payrolls/calculate` while keeping Kolonios
 * i18n, theming, RBAC, and the shadcn/Tailwind primitives:
 *
 *  1. "Hitung Gaji" (Calculate) tab — payroll records with date-range,
 *     division, and search filters; a "Bulk Action" affordance that calls
 *     `useGeneratePayroll` for the matching draft period.
 *  2. "Siap Bayar" (Ready to Pay) tab — the pay queue with division filter,
 *     `PayQueueSummaryBar`, paginated preview, and a CTA that opens the
 *     full bulk-pay experience on `/dashboard/admin/payroll/ready-to-pay`.
 *
 * URL state is intentionally minimal — only `?tab=` is synced so the tab
 * is deep-linkable and refresh-safe. Filters live in `useState`.
 *
 * The backend server fns and permission guards are unchanged; this file is
 * a UI layer over the existing `generate`, `records`, and `payQueue` flows.
 */
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  CalculatorIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  PrinterIcon,
  RefreshCwIcon,
  SearchIcon,
  WalletIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  payrollPeriodsQueryOptions,
  payrollRecordsQueryOptions,
  payQueueQueryOptions,
  type PayQueueFilters
} from '@/features/payroll/api/queries';
import { useApprovePayroll, useGeneratePayroll } from '@/features/payroll/api/mutations';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import {
  EMPLOYEE_QUERY_LIMIT_MAX,
  isEmployeeQueryTruncated
} from '@/features/employees/api/validation';
import { departmentsQueryOptions } from '@/features/masterdata/api/queries';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { maskBankAccount, PayQueueSummaryBar, formatPayrollMoney } from './-components';
import { toHoursMinutes } from './-records-columns';

const PAGE_SIZE = 25;

export function moneyToDisplay(money: unknown): string | null {
  if (typeof money !== 'number' || !Number.isFinite(money)) return null;
  return formatPayrollMoney((money / 100).toFixed(2));
}

type SnapshotLineItem = {
  name: string;
  type: string;
  amount: number;
  source?: string;
  taxable?: boolean;
};
type SnapshotTax = {
  method: string;
  taxableIncome: number;
  ptkp: number;
  amount: number;
  category?: string;
  bracket?: string;
};

export function parseSnapshot(row: Record<string, unknown>): {
  lineItems: SnapshotLineItem[];
  input: Array<Record<string, unknown>>;
  resolvedSegments: Array<Record<string, unknown>>;
  baseSalary: unknown;
  grossSalary: unknown;
  netSalary: unknown;
  allowanceTotal: unknown;
  deductionTotal: unknown;
} | null {
  const details = row.details as Record<string, unknown> | null;
  if (!details || typeof details !== 'object') return null;
  const lineItems = Array.isArray(details.lineItems)
    ? (details.lineItems as SnapshotLineItem[])
    : [];
  const input = Array.isArray(details.input)
    ? (details.input as Array<Record<string, unknown>>)
    : [];
  const resolvedSegments = Array.isArray(details.resolvedSegments)
    ? (details.resolvedSegments as Array<Record<string, unknown>>)
    : [];
  return {
    lineItems,
    input,
    resolvedSegments,
    baseSalary: details.baseSalary,
    grossSalary: details.grossSalary,
    netSalary: details.netSalary,
    allowanceTotal: details.allowanceTotal,
    deductionTotal: details.deductionTotal
  };
}

export function aggregateAttendance(inputs: Array<Record<string, unknown>>) {
  const totals = {
    scheduledDays: 0,
    payableDays: 0,
    workedHours: 0,
    permitHours: 0,
    shortfallHours: 0,
    absentDays: 0,
    lateCount: 0,
    unpaidLeaveDays: 0
  };
  for (const inp of inputs) {
    const att = (inp.attendance as Record<string, unknown> | undefined) ?? {};
    totals.scheduledDays += typeof att.scheduledDays === 'number' ? att.scheduledDays : 0;
    totals.payableDays += typeof att.payableDays === 'number' ? att.payableDays : 0;
    totals.workedHours += typeof att.workedHours === 'number' ? att.workedHours : 0;
    totals.permitHours += typeof att.permitHours === 'number' ? att.permitHours : 0;
    totals.shortfallHours += typeof att.shortfallHours === 'number' ? att.shortfallHours : 0;
    totals.absentDays += typeof att.absentDays === 'number' ? att.absentDays : 0;
    totals.lateCount += typeof att.lateCount === 'number' ? att.lateCount : 0;
    totals.unpaidLeaveDays += typeof att.unpaidLeaveDays === 'number' ? att.unpaidLeaveDays : 0;
  }
  return totals;
}

export function CalculatePage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canEdit = canPayrollAction(permissions, isAdmin, 'edit');
  const canView = canPayrollAction(permissions, isAdmin, 'view');

  // Expand state — single row at a time (Kerjoo payroll-row detail)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleRow = useCallback(
    (id: string) => {
      if (!canView) return;
      setExpandedId((prev) => (prev === id ? null : id));
    },
    [canView]
  );

  // Tab state (URL-synced via ?tab= — see index.tsx validateSearch)
  const routeSearch = useSearch({ strict: false }) as { tab?: 'calculate' | 'ready' };
  const navigate = useNavigate();
  const activeTab: 'calculate' | 'ready' = routeSearch.tab ?? 'calculate';
  const setActiveTab = (next: 'calculate' | 'ready') => {
    void navigate({
      to: '/dashboard/admin/payroll',
      search: (prev: Record<string, unknown>) => ({ ...prev, tab: next })
    });
  };

  // Calculate tab state ---------------------------------------------------------
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [division, setDivision] = useState('');
  const [search, setSearch] = useState('');

  // Ready-to-Pay tab state ------------------------------------------------------
  const [payDivision, setPayDivision] = useState('');
  const [payPage, setPayPage] = useState(1);

  const periodsQuery = useQuery(payrollPeriodsQueryOptions({ limit: 100 }));
  const employeesQuery = useQuery(
    employeesQueryOptions({ page: 1, limit: EMPLOYEE_QUERY_LIMIT_MAX, status: 'active' })
  );
  const departmentsQuery = useQuery(departmentsQueryOptions());

  const periods = periodsQuery.data?.rows ?? [];

  // Resolve a period from the date range filter (Bulk Action target).
  const matchedPeriod = useMemo(() => {
    if (!periodStart || !periodEnd) return null;
    return (
      periods.find((p) => p.period_start === periodStart && p.period_end === periodEnd) ?? null
    );
    // `periods` ref churns every render via TanStack Query; depend on the
    // stable upstream so the memo only recomputes when the query data
    // actually changes (suppresses react-hooks/exhaustive-deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodsQuery.data, periodStart, periodEnd]);
  const bulkEnabled = Boolean(matchedPeriod && matchedPeriod.status === 'draft' && canEdit);

  const recordsFilters = useMemo(
    () => ({
      page: 1,
      limit: 50,
      payrollPeriodId: matchedPeriod ? matchedPeriod.id : undefined,
      departmentId: division ? Number(division) : undefined
    }),
    [matchedPeriod, division]
  );
  const recordsQuery = useQuery(payrollRecordsQueryOptions(recordsFilters));

  // Records table — server-filtered by period/department, client-side search.
  type RecordRow = NonNullable<typeof recordsQuery.data>['rows'][number] & {
    worked_hours?: number | null;
  };
  const records = useMemo<RecordRow[]>(() => {
    const rows = (recordsQuery.data?.rows ?? []) as RecordRow[];
    if (!search.trim()) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter(
      (row) =>
        row.employee_name?.toLowerCase().includes(needle) ||
        row.employee_code?.toLowerCase().includes(needle) ||
        row.department_name?.toLowerCase().includes(needle)
    );
  }, [recordsQuery.data, search]);

  const payFilters: PayQueueFilters = useMemo(
    () => ({ departmentId: payDivision ? Number(payDivision) : undefined }),
    [payDivision]
  );
  const payQueue = useQuery(payQueueQueryOptions(payFilters));
  const payRows = payQueue.data?.rows ?? [];
  const payTotals = payQueue.data?.totals;
  const payTotalPages = Math.max(1, Math.ceil(payRows.length / PAGE_SIZE));
  const payVisible = payRows.slice((payPage - 1) * PAGE_SIZE, payPage * PAGE_SIZE);

  // Bulk generate ---------------------------------------------------------------
  const canApprove = canPayrollAction(permissions, isAdmin, 'approve');
  const approve = useApprovePayroll();
  const [approvingPeriodId, setApprovingPeriodId] = useState<number | null>(null);

  const inFlightRef = useRef(false);
  const generate = useGeneratePayroll();
  const runBulkGenerate = async () => {
    if (!bulkEnabled || !matchedPeriod) {
      toast.error(t('payroll.calculateTab.bulkNeedPeriod'));
      return;
    }
    if (inFlightRef.current || generate.isPending) return;
    inFlightRef.current = true;
    try {
      await generate.mutateAsync({ payrollPeriodId: matchedPeriod.id });
      toast.success(t('payroll.generated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payroll.failed'));
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <div className='space-y-4'>
      {/* Tab list — Kerjoo style: pill buttons, badge on Ready tab */}
      <div className='overflow-x-auto'>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'calculate' | 'ready')}>
          <TabsList className='h-auto w-fit p-1'>
            <TabsTrigger value='calculate' className='gap-2 px-4 py-2'>
              <CalculatorIcon className='h-4 w-4' />
              <span>{t('payroll.calculateTab.tab')}</span>
            </TabsTrigger>
            <TabsTrigger value='ready' className='gap-2 px-4 py-2'>
              <WalletIcon className='h-4 w-4' />
              <span>{t('payroll.payQueue.tab')}</span>
              <Badge
                variant='secondary'
                className={
                  payTotals && payTotals.employeeCount > 0
                    ? 'ml-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'ml-1 bg-muted text-muted-foreground opacity-60'
                }
              >
                {payTotals?.employeeCount ?? 0}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ====================== TAB: HITUNG GAJI ====================== */}
          <TabsContent value='calculate' className='mt-4 space-y-4'>
            <Card className='overflow-hidden'>
              <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0 p-3 sm:p-4'>
                <CardTitle className='text-base'>{t('payroll.calculateTab.title')}</CardTitle>
                <Button
                  variant='default'
                  size='sm'
                  onClick={() => void runBulkGenerate()}
                  disabled={!bulkEnabled || generate.isPending}
                  title={
                    !matchedPeriod
                      ? t('payroll.calculateTab.bulkNeedPeriod')
                      : matchedPeriod.status !== 'draft'
                        ? t('payroll.payQueue.viewOnlyNotice')
                        : undefined
                  }
                  className='gap-2'
                >
                  <RefreshCwIcon className='h-4 w-4' />
                  {generate.isPending
                    ? t('payroll.generating')
                    : t('payroll.calculateTab.bulkAction')}
                </Button>
              </CardHeader>
              <CardContent className='space-y-3 p-3 sm:p-4'>
                {/* Filter row — date range + division + search + action icons (Kerjoo div.p-3 layout) */}
                <div className='flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end'>
                  <div className='flex items-end gap-2 lg:basis-[280px]'>
                    <div className='flex-1 space-y-1'>
                      <label className='text-xs font-medium text-muted-foreground'>
                        {t('payroll.calculateTab.startDate')}
                      </label>
                      <DatePicker
                        ariaLabel={t('payroll.calculateTab.startDate')}
                        value={periodStart}
                        onChange={(v) => setPeriodStart(v ?? '')}
                        placeholder={t('payroll.calculateTab.startDate')}
                      />
                    </div>
                    <span className='pb-2 text-muted-foreground'>
                      {t('payroll.calculateTab.dateRangeSeparator')}
                    </span>
                    <div className='flex-1 space-y-1'>
                      <label className='text-xs font-medium text-muted-foreground'>
                        {t('payroll.calculateTab.endDate')}
                      </label>
                      <DatePicker
                        ariaLabel={t('payroll.calculateTab.endDate')}
                        value={periodEnd}
                        onChange={(v) => setPeriodEnd(v ?? '')}
                        placeholder={t('payroll.calculateTab.endDate')}
                        minDate={periodStart || undefined}
                      />
                    </div>
                  </div>

                  <div className='space-y-1 lg:basis-[230px]'>
                    <label className='text-xs font-medium text-muted-foreground'>
                      {t('payroll.payQueue.division')}
                    </label>
                    <NativeSelect value={division} onChange={(e) => setDivision(e.target.value)}>
                      <option value=''>{t('payroll.payQueue.allDivisions')}</option>
                      {(departmentsQuery.data?.departments ?? []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className='space-y-1 lg:basis-[230px]'>
                    <label className='text-xs font-medium text-muted-foreground'>
                      {t('common.search')}
                    </label>
                    <div className='relative'>
                      <SearchIcon className='pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                      <Input
                        type='search'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('common.search')}
                        className='pl-8'
                      />
                    </div>
                  </div>
                </div>

                {/* Status line: active employees + truncation warning */}
                <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
                  <span>
                    {t('payroll.employeeCount')}
                    {t('payroll.calculateTab.labelColon')}{' '}
                    <span className='font-semibold text-foreground'>
                      {employeesQuery.isLoading ? '…' : (employeesQuery.data?.total_employees ?? 0)}
                    </span>
                  </span>
                  {isEmployeeQueryTruncated(employeesQuery.data?.total_employees) && (
                    <span className='text-amber-700'>
                      {t('payroll.employeeLimitWarning', { count: EMPLOYEE_QUERY_LIMIT_MAX })}
                    </span>
                  )}
                </div>

                {recordsQuery.isError && (
                  <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
                )}
                {generate.isError && (
                  <p className='text-sm text-destructive'>
                    {generate.error instanceof Error
                      ? generate.error.message
                      : t('payroll.missingData')}
                  </p>
                )}

                {/* Helper text ala Kerjoo + footer Showing */}
                <p className='text-xs text-muted-foreground'>
                  {t('payroll.calculateTab.periodHelp', {
                    defaultValue:
                      'The salary calculation period can be set through the time range above. For the salary calculation formula, can be seen here.'
                  })}
                </p>

                {/* Employee table — Kerjoo-faithful columns: Employee | Base Salary | Rekening Bank | Total Work & Overtime | THP */}
                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='min-w-[240px]'>{t('payroll.employee')}</TableHead>
                        <TableHead className='min-w-[160px]'>
                          {t('payroll.baseSalary', { defaultValue: 'Base Salary' })}
                        </TableHead>
                        <TableHead className='min-w-[180px]'>
                          {t('payroll.bankAccount', { defaultValue: 'Rekening Bank' })}
                        </TableHead>
                        <TableHead className='whitespace-nowrap'>
                          {t('payroll.totalWorkOvertime', {
                            defaultValue: 'Total Work & Overtime'
                          })}
                        </TableHead>
                        <TableHead className='text-right whitespace-nowrap'>
                          {t('payroll.thp')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recordsQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>
                            {t('common.loading')}
                          </TableCell>
                        </TableRow>
                      ) : records.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>
                            {t('payroll.noRecords')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        records.map((row) => {
                          const { whole, minutes } = toHoursMinutes(row.worked_hours);
                          // Enriched fields from listPayrollRecords (may be null for empty details)
                          const baseSalary = (row as { base_salary_amount?: string | null })
                            .base_salary_amount;
                          const componentCount = (row as { component_count?: number | null })
                            .component_count;
                          const salaryType = (row as { salary_type?: string | null }).salary_type;
                          const bankName = (row as { bank_name?: string | null }).bank_name;
                          const accountNumber = (row as { account_number?: string | null })
                            .account_number;
                          const accountName = (row as { account_name?: string | null })
                            .account_name;
                          const designation = (row as { designation_name?: string | null })
                            .designation_name;
                          const salarySuffix =
                            salaryType === 'daily'
                              ? '/day'
                              : salaryType === 'hourly'
                                ? '/hour'
                                : '/month';
                          const isExpanded = expandedId === String(row.id);
                          const rowInteractive = canView;
                          const snapshot = parseSnapshot(row as unknown as Record<string, unknown>);
                          const detailId = `payroll-detail-${row.id}`;
                          return (
                            <Fragment key={row.id}>
                              <TableRow
                                data-testid='payroll-row'
                                aria-expanded={isExpanded}
                                aria-controls={rowInteractive ? detailId : undefined}
                                tabIndex={rowInteractive ? 0 : undefined}
                                role={rowInteractive ? 'button' : undefined}
                                className={
                                  rowInteractive
                                    ? 'group cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' +
                                      (isExpanded ? ' bg-muted/20' : '')
                                    : 'group'
                                }
                                onClick={() => toggleRow(String(row.id))}
                                onKeyDown={(e) => {
                                  if (!rowInteractive) return;
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleRow(String(row.id));
                                  } else if (e.key === 'Escape') {
                                    setExpandedId(null);
                                  }
                                }}
                              >
                                <TableCell>
                                  <div className='flex items-start gap-2'>
                                    {isExpanded ? (
                                      <ChevronDownIcon className='mt-1 h-4 w-4 shrink-0 text-foreground transition-transform' />
                                    ) : (
                                      <ChevronRightIcon className='mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground group-focus-visible:text-foreground' />
                                    )}
                                    <div className='flex flex-col'>
                                      <span className='font-medium leading-tight'>
                                        {row.employee_name ?? '—'}
                                      </span>
                                      <span className='text-xs leading-tight text-muted-foreground'>
                                        {[designation, row.department_name]
                                          .filter(Boolean)
                                          .join(' | ') ||
                                          row.employee_code ||
                                          '—'}
                                      </span>
                                      <span className='text-[11px] leading-tight text-muted-foreground'>
                                        {['WIB (UTC+7)', row.employee_code]
                                          .filter(Boolean)
                                          .join(' | ')}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {baseSalary ? (
                                    <div className='flex flex-col'>
                                      <span className='font-medium tabular-nums'>
                                        {formatPayrollMoney(baseSalary)}
                                        {salarySuffix}
                                      </span>
                                      <span className='text-xs text-muted-foreground'>
                                        {componentCount != null
                                          ? t('payroll.componentCount', {
                                              count: componentCount,
                                              defaultValue: `${componentCount} komponen`
                                            })
                                          : t('payroll.noComponentCount', { defaultValue: '—' })}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className='text-muted-foreground'>
                                      {t('payroll.notSet', { defaultValue: 'Belum diset' })}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {bankName ? (
                                    <div className='flex flex-col text-xs'>
                                      <span className='font-medium'>{bankName}</span>
                                      <span className='font-mono text-muted-foreground'>
                                        {accountNumber ? maskBankAccount(accountNumber) : '—'}
                                      </span>
                                      <span className='text-muted-foreground truncate'>
                                        {accountName ?? row.employee_name ?? '—'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className='text-muted-foreground'>{'—'}</span>
                                  )}
                                </TableCell>
                                <TableCell className='whitespace-nowrap tabular-nums text-muted-foreground'>
                                  {t('payroll.hoursDisplay', { whole, minutes })}
                                </TableCell>
                                <TableCell className='text-right'>
                                  <div className='flex flex-col items-end gap-1'>
                                    <span className='font-semibold tabular-nums'>
                                      {formatPayrollMoney(row.net_salary)}
                                    </span>
                                    <Badge
                                      variant={row.paid_at ? 'default' : 'outline'}
                                      className='text-[11px]'
                                    >
                                      {row.paid_at
                                        ? t('payroll.paidLabel')
                                        : t('payroll.unpaidLabel')}
                                    </Badge>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className='hover:bg-transparent'>
                                  <TableCell colSpan={5} className='bg-muted/10 p-0'>
                                    <div id={detailId} className='border-t bg-card p-3 sm:p-4'>
                                      {(() => {
                                        if (!snapshot) {
                                          return (
                                            <p className='py-6 text-center text-sm text-muted-foreground'>
                                              {t('payroll.detailTabs.empty', {
                                                defaultValue:
                                                  'No detail data — click an adjustment or view the full profile for more.'
                                              })}
                                            </p>
                                          );
                                        }
                                        const {
                                          lineItems,
                                          input,
                                          resolvedSegments,
                                          baseSalary,
                                          grossSalary,
                                          netSalary,
                                          allowanceTotal,
                                          deductionTotal
                                        } = snapshot;
                                        const attendance = aggregateAttendance(input);
                                        const deductionItems = lineItems.filter(
                                          (i) =>
                                            i.type === 'deduction' ||
                                            i.type === 'attendance-deduction'
                                        );
                                        const bonusItems = lineItems.filter(
                                          (i) => i.type === 'allowance'
                                        );
                                        const firstTax = (() => {
                                          const seg = resolvedSegments[0] as
                                            | Record<string, unknown>
                                            | undefined;
                                          const result = seg?.result as
                                            | Record<string, unknown>
                                            | undefined;
                                          const tax = result?.tax as SnapshotTax | undefined;
                                          if (tax && typeof tax.amount === 'number') return tax;
                                          const taxItem = lineItems.find((i) => i.type === 'tax');
                                          if (taxItem)
                                            return {
                                              method: 'progressive',
                                              taxableIncome: 0,
                                              ptkp: 0,
                                              amount: taxItem.amount
                                            } as SnapshotTax;
                                          return null;
                                        })();
                                        return (
                                          <Tabs defaultValue={'summary'} className='w-full'>
                                            <TabsList className='h-auto w-full justify-start gap-1 overflow-x-auto p-1'>
                                              <TabsTrigger
                                                value='summary'
                                                className='whitespace-nowrap px-3 py-1.5 text-xs'
                                              >
                                                {t('payroll.detailTabs.summary', {
                                                  defaultValue: 'Summary'
                                                })}
                                              </TabsTrigger>
                                              <TabsTrigger
                                                value='work'
                                                className='whitespace-nowrap px-3 py-1.5 text-xs'
                                              >
                                                {t('payroll.detailTabs.work', {
                                                  defaultValue: 'Total Work & Overtime'
                                                })}
                                              </TabsTrigger>
                                              <TabsTrigger
                                                value='deduction'
                                                className='whitespace-nowrap px-3 py-1.5 text-xs'
                                              >
                                                {t('payroll.detailTabs.deduction', {
                                                  defaultValue: 'Deduction'
                                                })}
                                              </TabsTrigger>
                                              <TabsTrigger
                                                value='bonus'
                                                className='whitespace-nowrap px-3 py-1.5 text-xs'
                                              >
                                                {t('payroll.detailTabs.bonus', {
                                                  defaultValue: 'Bonus'
                                                })}
                                              </TabsTrigger>
                                              <TabsTrigger
                                                value='pph21'
                                                className='whitespace-nowrap px-3 py-1.5 text-xs'
                                              >
                                                {t('payroll.detailTabs.pph21', {
                                                  defaultValue: 'PPh21'
                                                })}
                                              </TabsTrigger>
                                            </TabsList>
                                            <TabsContent value='summary' className='mt-3 space-y-3'>
                                              <div className='grid gap-2 text-xs sm:grid-cols-3'>
                                                <div className='rounded-md border bg-muted/20 p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.baseSalary', {
                                                      defaultValue: 'Base Salary'
                                                    })}
                                                  </div>
                                                  <div className='font-medium tabular-nums'>
                                                    {moneyToDisplay(baseSalary) ?? '—'}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border bg-muted/20 p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.gross', { defaultValue: 'Gross' })}
                                                  </div>
                                                  <div className='font-medium tabular-nums'>
                                                    {moneyToDisplay(grossSalary) ??
                                                      formatPayrollMoney(row.gross_salary)}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border bg-muted/20 p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.thp')}
                                                  </div>
                                                  <div className='font-semibold tabular-nums'>
                                                    {moneyToDisplay(netSalary) ??
                                                      formatPayrollMoney(row.net_salary)}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border bg-muted/20 p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.allowances', {
                                                      defaultValue: 'Allowances'
                                                    })}
                                                  </div>
                                                  <div className='font-medium tabular-nums'>
                                                    {moneyToDisplay(allowanceTotal) ?? '—'}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border bg-muted/20 p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.deductions', {
                                                      defaultValue: 'Deductions'
                                                    })}
                                                  </div>
                                                  <div className='font-medium tabular-nums'>
                                                    {moneyToDisplay(deductionTotal) ?? '—'}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border bg-muted/20 p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.totalWork', {
                                                      defaultValue: 'Total Work'
                                                    })}
                                                  </div>
                                                  <div className='font-medium tabular-nums'>
                                                    {t('payroll.hoursDisplay', {
                                                      whole: toHoursMinutes(row.worked_hours).whole,
                                                      minutes: toHoursMinutes(row.worked_hours)
                                                        .minutes
                                                    })}
                                                  </div>
                                                </div>
                                              </div>
                                              {lineItems.length > 0 ? (
                                                <div className='overflow-x-auto rounded-md border'>
                                                  <table className='w-full text-xs'>
                                                    <thead className='bg-muted/40 text-muted-foreground'>
                                                      <tr>
                                                        <th className='px-2 py-1.5 text-left font-medium'>
                                                          {t('payroll.component', {
                                                            defaultValue: 'Component'
                                                          })}
                                                        </th>
                                                        <th className='px-2 py-1.5 text-left font-medium'>
                                                          {t('common.type', {
                                                            defaultValue: 'Type'
                                                          })}
                                                        </th>
                                                        <th className='px-2 py-1.5 text-right font-medium'>
                                                          {t('payroll.amount', {
                                                            defaultValue: 'Amount'
                                                          })}
                                                        </th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {lineItems.map((item, idx) => (
                                                        <tr
                                                          key={`${item.name}-${idx}`}
                                                          className='border-t'
                                                        >
                                                          <td className='px-2 py-1.5'>
                                                            {item.name}
                                                          </td>
                                                          <td className='px-2 py-1.5 text-muted-foreground'>
                                                            {item.type}
                                                          </td>
                                                          <td className='px-2 py-1.5 text-right tabular-nums'>
                                                            {moneyToDisplay(item.amount) ?? '—'}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              ) : (
                                                <p className='py-4 text-center text-sm text-muted-foreground'>
                                                  {t('payroll.detailTabs.empty', {
                                                    defaultValue:
                                                      'No detail data — click an adjustment or view the full profile for more.'
                                                  })}
                                                </p>
                                              )}
                                              <div className='flex flex-wrap items-center justify-between gap-2 border-t pt-3'>
                                                <div className='flex items-center gap-2'>
                                                  {canEdit && (
                                                    <Button
                                                      size='sm'
                                                      className='gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white'
                                                      asChild
                                                    >
                                                      <Link to='/dashboard/admin/payroll/profile'>
                                                        <PencilIcon className='h-3.5 w-3.5' />
                                                        {t('payroll.editBaseSalary', {
                                                          defaultValue: 'Set Base Salary'
                                                        })}
                                                      </Link>
                                                    </Button>
                                                  )}
                                                  <Button
                                                    variant='outline'
                                                    size='sm'
                                                    asChild
                                                    className='gap-1.5'
                                                  >
                                                    <Link
                                                      to='/dashboard/admin/payroll/records/$id/print'
                                                      params={{ id: String(row.id) }}
                                                      search={
                                                        {
                                                          start: (row as { period_start?: string })
                                                            .period_start,
                                                          end: (row as { period_end?: string })
                                                            .period_end
                                                        } as never
                                                      }
                                                    >
                                                      <PrinterIcon className='h-3.5 w-3.5' />
                                                      {t('common.print', { defaultValue: 'Print' })}
                                                    </Link>
                                                  </Button>
                                                </div>
                                                <div className='flex items-center gap-2'>
                                                  {row.paid_at ? (
                                                    <Badge
                                                      variant='default'
                                                      className='gap-1 bg-emerald-600'
                                                    >
                                                      <CheckIcon className='h-3 w-3' />
                                                      {t('payroll.paidLabel')}
                                                    </Badge>
                                                  ) : row.period_status === 'ready_to_pay' ? (
                                                    <Badge
                                                      variant='secondary'
                                                      className='gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                                    >
                                                      <CheckIcon className='h-3 w-3' />
                                                      {t('payroll.statuses.ready_to_pay')}
                                                    </Badge>
                                                  ) : canApprove ? (
                                                    <Button
                                                      size='sm'
                                                      variant='default'
                                                      className='gap-1.5'
                                                      disabled={
                                                        approve.isPending &&
                                                        approvingPeriodId === row.payroll_period_id
                                                      }
                                                      onClick={async () => {
                                                        if (approvingPeriodId !== null) return;
                                                        setApprovingPeriodId(row.payroll_period_id);
                                                        try {
                                                          await approve.mutateAsync({
                                                            id: row.payroll_period_id
                                                          });
                                                          toast.success(
                                                            t('payroll.markReadySuccess')
                                                          );
                                                        } catch (error) {
                                                          toast.error(
                                                            error instanceof Error
                                                              ? error.message
                                                              : t('payroll.failed')
                                                          );
                                                        } finally {
                                                          setApprovingPeriodId(null);
                                                        }
                                                      }}
                                                    >
                                                      <CheckIcon className='h-3.5 w-3.5' />
                                                      {approve.isPending &&
                                                      approvingPeriodId === row.payroll_period_id
                                                        ? t('common.saving', {
                                                            defaultValue: 'Saving…'
                                                          })
                                                        : t('payroll.markReadyToPay')}
                                                    </Button>
                                                  ) : (
                                                    <Badge variant='outline' className='gap-1'>
                                                      <CheckIcon className='h-3 w-3' />
                                                      {t('payroll.markReadyToPay')}
                                                    </Badge>
                                                  )}
                                                  <Button
                                                    variant='ghost'
                                                    size='sm'
                                                    asChild
                                                    className='h-auto px-2 text-xs'
                                                  >
                                                    <Link to='/dashboard/admin/payroll/profile'>
                                                      {t('payroll.viewProfile', {
                                                        defaultValue: 'View profile'
                                                      })}{' '}
                                                      <ArrowRightIcon className='ml-1 h-3 w-3' />
                                                    </Link>
                                                  </Button>
                                                </div>
                                              </div>
                                            </TabsContent>
                                            <TabsContent value='work' className='mt-3'>
                                              <div className='grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4'>
                                                <div className='rounded-md border p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.scheduledDays', {
                                                      defaultValue: 'Scheduled Days'
                                                    })}
                                                  </div>
                                                  <div className='font-medium'>
                                                    {attendance.scheduledDays}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.payableDays', {
                                                      defaultValue: 'Payable Days'
                                                    })}
                                                  </div>
                                                  <div className='font-medium'>
                                                    {attendance.payableDays}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.workedHours', {
                                                      defaultValue: 'Worked Hours'
                                                    })}
                                                  </div>
                                                  <div className='font-medium'>
                                                    {attendance.workedHours}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.permitHours', {
                                                      defaultValue: 'Permit Hours'
                                                    })}
                                                  </div>
                                                  <div className='font-medium'>
                                                    {attendance.permitHours}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.shortfallHours', {
                                                      defaultValue: 'Shortfall Hours'
                                                    })}
                                                  </div>
                                                  <div className='font-medium'>
                                                    {attendance.shortfallHours}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('attendance.absent', {
                                                      defaultValue: 'Absent'
                                                    })}
                                                  </div>
                                                  <div className='font-medium'>
                                                    {attendance.absentDays}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('payroll.lateCount', {
                                                      defaultValue: 'Late count'
                                                    })}
                                                  </div>
                                                  <div className='font-medium'>
                                                    {attendance.lateCount}
                                                  </div>
                                                </div>
                                                <div className='rounded-md border p-2'>
                                                  <div className='text-muted-foreground'>
                                                    {t('attendance.unpaidLeave', {
                                                      defaultValue: 'Unpaid Leave'
                                                    })}
                                                  </div>
                                                  <div className='font-medium'>
                                                    {attendance.unpaidLeaveDays}
                                                  </div>
                                                </div>
                                              </div>
                                            </TabsContent>
                                            <TabsContent value='deduction' className='mt-3'>
                                              {deductionItems.length > 0 ? (
                                                <div className='overflow-x-auto rounded-md border'>
                                                  <table className='w-full text-xs'>
                                                    <thead className='bg-muted/40 text-muted-foreground'>
                                                      <tr>
                                                        <th className='px-2 py-1.5 text-left font-medium'>
                                                          {t('payroll.component', {
                                                            defaultValue: 'Component'
                                                          })}
                                                        </th>
                                                        <th className='px-2 py-1.5 text-right font-medium'>
                                                          {t('payroll.amount', {
                                                            defaultValue: 'Amount'
                                                          })}
                                                        </th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {deductionItems.map((item, idx) => (
                                                        <tr
                                                          key={`ded-${item.name}-${idx}`}
                                                          className='border-t'
                                                        >
                                                          <td className='px-2 py-1.5'>
                                                            {item.name}
                                                          </td>
                                                          <td className='px-2 py-1.5 text-right tabular-nums'>
                                                            {moneyToDisplay(item.amount) ?? '—'}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              ) : (
                                                <p className='py-6 text-center text-sm text-muted-foreground'>
                                                  {t('payroll.detailTabs.deductionEmpty', {
                                                    defaultValue: 'No deductions for this period.'
                                                  })}
                                                </p>
                                              )}
                                            </TabsContent>
                                            <TabsContent value='bonus' className='mt-3'>
                                              {bonusItems.length > 0 ? (
                                                <div className='overflow-x-auto rounded-md border'>
                                                  <table className='w-full text-xs'>
                                                    <thead className='bg-muted/40 text-muted-foreground'>
                                                      <tr>
                                                        <th className='px-2 py-1.5 text-left font-medium'>
                                                          {t('payroll.component', {
                                                            defaultValue: 'Component'
                                                          })}
                                                        </th>
                                                        <th className='px-2 py-1.5 text-right font-medium'>
                                                          {t('payroll.amount', {
                                                            defaultValue: 'Amount'
                                                          })}
                                                        </th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {bonusItems.map((item, idx) => (
                                                        <tr
                                                          key={`bon-${item.name}-${idx}`}
                                                          className='border-t'
                                                        >
                                                          <td className='px-2 py-1.5'>
                                                            {item.name}
                                                          </td>
                                                          <td className='px-2 py-1.5 text-right tabular-nums'>
                                                            {moneyToDisplay(item.amount) ?? '—'}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              ) : (
                                                <p className='py-6 text-center text-sm text-muted-foreground'>
                                                  {t('payroll.detailTabs.bonusEmpty', {
                                                    defaultValue: 'No bonuses for this period.'
                                                  })}
                                                </p>
                                              )}
                                            </TabsContent>
                                            <TabsContent value='pph21' className='mt-3'>
                                              {firstTax ? (
                                                <div className='grid gap-2 text-xs sm:grid-cols-2'>
                                                  <div className='rounded-md border p-2'>
                                                    <div className='text-muted-foreground'>
                                                      {t('payroll.taxableIncome', {
                                                        defaultValue: 'Taxable Income'
                                                      })}
                                                    </div>
                                                    <div className='font-medium tabular-nums'>
                                                      {moneyToDisplay(firstTax.taxableIncome) ??
                                                        '—'}
                                                    </div>
                                                  </div>
                                                  <div className='rounded-md border p-2'>
                                                    <div className='text-muted-foreground'>
                                                      {t('payroll.ptkpStatus', {
                                                        defaultValue: 'PTKP'
                                                      })}
                                                    </div>
                                                    <div className='font-medium tabular-nums'>
                                                      {moneyToDisplay(firstTax.ptkp) ?? '—'}
                                                    </div>
                                                  </div>
                                                  <div className='rounded-md border p-2'>
                                                    <div className='text-muted-foreground'>
                                                      {t('payroll.taxAmount', {
                                                        defaultValue: 'Tax Amount'
                                                      })}
                                                    </div>
                                                    <div className='font-medium tabular-nums'>
                                                      {moneyToDisplay(firstTax.amount) ?? '—'}
                                                    </div>
                                                  </div>
                                                  <div className='rounded-md border p-2'>
                                                    <div className='text-muted-foreground'>
                                                      {t('payroll.pph21Method', {
                                                        defaultValue: 'Method'
                                                      })}
                                                    </div>
                                                    <div className='font-medium'>
                                                      {firstTax.method ?? '—'}
                                                    </div>
                                                  </div>
                                                  {firstTax.category && (
                                                    <div className='rounded-md border p-2'>
                                                      <div className='text-muted-foreground'>
                                                        {t('payroll.taxCategory', {
                                                          defaultValue: 'Category'
                                                        })}
                                                      </div>
                                                      <div className='font-medium'>
                                                        {firstTax.category}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {firstTax.bracket && (
                                                    <div className='rounded-md border p-2'>
                                                      <div className='text-muted-foreground'>
                                                        {t('payroll.taxBracket', {
                                                          defaultValue: 'Bracket'
                                                        })}
                                                      </div>
                                                      <div className='font-medium'>
                                                        {firstTax.bracket}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <p className='py-6 text-center text-sm text-muted-foreground'>
                                                  {t('payroll.detailTabs.pph21Empty', {
                                                    defaultValue: 'No PPh21 data for this period.'
                                                  })}
                                                </p>
                                              )}
                                            </TabsContent>
                                          </Tabs>
                                        );
                                      })()}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {!recordsQuery.isLoading && records.length > 0 && (
                  <p className='text-xs text-muted-foreground'>
                    {t('payroll.showingEntries', {
                      count: records.length,
                      total: records.length,
                      defaultValue: `Showing ${records.length} from ${records.length} entries`
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====================== TAB: SIAP BAYAR ====================== */}
          <TabsContent value='ready' className='mt-4 space-y-4'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
                <CardTitle className='text-base'>{t('payroll.payQueue.title')}</CardTitle>
                <Button asChild size='sm' className='gap-2'>
                  <Link to='/dashboard/admin/payroll/ready-to-pay'>
                    {t('payroll.payQueue.paySelected')}
                    <ArrowRightIcon className='h-4 w-4' />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className='space-y-4'>
                {/* Division filter (matches Kerjoo's Ready To Pay filter row) */}
                <div className='flex flex-wrap items-end gap-3'>
                  <div className='space-y-1 lg:basis-[230px]'>
                    <label className='text-xs font-medium text-muted-foreground'>
                      {t('payroll.payQueue.division')}
                    </label>
                    <NativeSelect
                      value={payDivision}
                      onChange={(e) => {
                        setPayDivision(e.target.value);
                        setPayPage(1);
                      }}
                    >
                      <option value=''>{t('payroll.payQueue.allDivisions')}</option>
                      {(departmentsQuery.data?.departments ?? []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                {payTotals && (
                  <PayQueueSummaryBar
                    t={t}
                    totalNet={payTotals.totalNet}
                    employeeCount={payTotals.employeeCount}
                    selectedCount={0}
                    selectedNet='0'
                  />
                )}

                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('payroll.employee')}</TableHead>
                        <TableHead>{t('payroll.payQueue.division')}</TableHead>
                        <TableHead>{t('payroll.payQueue.bank')}</TableHead>
                        <TableHead>{t('payroll.period')}</TableHead>
                        <TableHead className='text-right'>{t('payroll.thp')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payQueue.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>
                            {t('common.loading')}
                          </TableCell>
                        </TableRow>
                      ) : payRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className='py-6 text-center text-muted-foreground'>
                            {t('payroll.payQueue.empty')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        payVisible.map((row) => (
                          <TableRow key={row.recordId}>
                            <TableCell>
                              <div className='flex flex-col'>
                                <span className='font-medium'>{row.employeeName}</span>
                                <span className='text-xs text-muted-foreground'>
                                  {row.employeeId}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className='text-muted-foreground'>
                              {row.departmentName ?? '—'}
                            </TableCell>
                            <TableCell className='font-mono text-xs'>
                              {row.bankName ? `${row.bankName} ${row.accountNumber ?? ''}` : '—'}
                            </TableCell>
                            <TableCell>
                              <div className='flex flex-col'>
                                <span>{row.periodName}</span>
                                <span className='text-xs text-muted-foreground'>
                                  {row.paymentDate ?? `${row.periodStart} — ${row.periodEnd}`}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className='text-right font-semibold tabular-nums'>
                              {formatPayrollMoney(row.netSalary)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination — 25 rows per page (Q14) */}
                {payRows.length > PAGE_SIZE && (
                  <div className='flex items-center justify-between text-xs text-muted-foreground'>
                    <span>
                      {(payPage - 1) * PAGE_SIZE + 1}
                      {t('payroll.calculateTab.dateRangeSeparator')}
                      {Math.min(payPage * PAGE_SIZE, payRows.length)} {t('payroll.separator')}{' '}
                      {payRows.length}
                    </span>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setPayPage((p) => Math.max(1, p - 1))}
                        disabled={payPage === 1}
                      >
                        {t('payroll.pagination.prev')}
                      </Button>
                      <span>
                        {payPage} {t('payroll.pagination.separator')} {payTotalPages}
                      </span>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setPayPage((p) => Math.min(payTotalPages, p + 1))}
                        disabled={payPage === payTotalPages}
                      >
                        {t('payroll.pagination.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
