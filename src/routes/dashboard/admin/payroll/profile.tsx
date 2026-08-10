import { useEffect, useMemo, useRef, useState } from 'react';
import { Block, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  employeePayrollProfileQueryOptions,
  salaryComponentsQueryOptions
} from '@/features/payroll/api/queries';
import { useUpdateEmployeePayrollProfile } from '@/features/payroll/api/mutations';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import { updateEmployeePayrollProfileFn } from '@/features/payroll/api/service';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { maskBankAccount, validDates, formatPayrollMoney } from './-components';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BpjsEnrollmentCard } from './-profile-bpjs';
import {
  TaxDraft,
  TaxHistoryCard,
  TaxProfileSelects,
  type TaxRecord
} from './-profile-tax-history';
import { PaymentHistoryCard, type PaymentHistoryRow } from './-profile-payment-history';

export const Route = createFileRoute('/dashboard/admin/payroll/profile')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: ProfilePage
});

type Assignment = {
  id: number;
  employee_id: string;
  salary_type: 'monthly' | 'daily' | 'hourly';
  amount: string;
  effective_from: string;
  effective_to: string | null;
  department_id: number | null;
  designation_id: number | null;
};
type ProfileComponent = {
  component: {
    id: number;
    assignment_id: number;
    salary_component_id: number;
    amount: string;
    mode: 'fixed' | 'percentage' | 'per-attendance';
    percentage_base: 'base-salary' | 'gross-salary' | null;
    attendance_metric: 'payable-days' | 'worked-hours' | 'late-count' | null;
    taxable: boolean;
    effective_from: string;
    effective_to: string | null;
  };
  definition: { id: number; name: string; type: 'allowance' | 'deduction' };
};
type TaxProfile = {
  id: number;
  tax_setting_id: number | null;
  tax_identifier: string | null;
  filing_status: string | null;
  employment_status: string;
  ptkp_status: string;
  residency: string;
  tax_facility: string;
  tax_object_code: string;
  pph21_method: string | null;
  effective_from: string;
  effective_to: string | null;
};
type Benefit = {
  id: number;
  benefit_code: string;
  benefit_name: string;
  amount: string | null;
  effective_from: string;
  effective_to: string | null;
  status: string;
};
type BankAccount = {
  id: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  is_primary: boolean;
  effective_from: string;
  effective_to: string | null;
};
type ProfileData = {
  assignment: Assignment | null;
  assignments: Assignment[];
  components: ProfileComponent[];
  tax: TaxProfile | null;
  taxProfiles: TaxProfile[];
  benefits: Benefit[];
  bank: BankAccount | null;
  bankAccounts: BankAccount[];
  taxRecords: TaxRecord[];
  paymentHistory: PaymentHistoryRow[];
};
type ComponentDraft = {
  id?: number;
  assignmentId: number;
  salaryComponentId: number;
  amount: string;
  mode: 'fixed' | 'percentage' | 'per-attendance';
  percentageBase: 'base-salary' | 'gross-salary';
  attendanceMetric: 'payable-days' | 'worked-hours' | 'late-count';
  taxable: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};
type BenefitDraft = {
  id?: number;
  benefitCode: string;
  benefitName: string;
  amount: string;
  status: 'active' | 'inactive';
  effectiveFrom: string;
  effectiveTo: string;
};
type BankDraft = {
  id?: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};
type ProfileMutation = Parameters<typeof updateEmployeePayrollProfileFn>[0]['data'];

export function profileRecordId(id: number | undefined) {
  return id && id > 0 ? id : undefined;
}

type DraftState = {
  assignment: Assignment | null;
  componentDrafts: Record<number, ComponentDraft>;
  taxDrafts: Record<number, TaxDraft>;
  benefitDrafts: Record<number, BenefitDraft>;
  bankDrafts: Record<number, BankDraft>;
  newComponentDraft: ComponentDraft | null;
  newTaxDraft: TaxDraft | null;
  newBenefitDraft: BenefitDraft | null;
  newBankDraft: BankDraft | null;
};

function shallowEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function mapEqual<T extends object>(a: Record<number, T>, b: Record<number, T>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (
      !shallowEqual(
        a[Number(key)] as Record<string, unknown>,
        b[Number(key)] as Record<string, unknown>
      )
    )
      return false;
  }
  return true;
}

function snapshotsEqual(a: DraftState, b: DraftState): boolean {
  return (
    shallowEqual(
      a.assignment as Record<string, unknown> | null,
      b.assignment as Record<string, unknown> | null
    ) &&
    mapEqual(a.componentDrafts, b.componentDrafts) &&
    mapEqual(a.taxDrafts, b.taxDrafts) &&
    mapEqual(a.benefitDrafts, b.benefitDrafts) &&
    mapEqual(a.bankDrafts, b.bankDrafts) &&
    shallowEqual(
      a.newComponentDraft as Record<string, unknown> | null,
      b.newComponentDraft as Record<string, unknown> | null
    ) &&
    shallowEqual(
      a.newTaxDraft as Record<string, unknown> | null,
      b.newTaxDraft as Record<string, unknown> | null
    ) &&
    shallowEqual(
      a.newBenefitDraft as Record<string, unknown> | null,
      b.newBenefitDraft as Record<string, unknown> | null
    ) &&
    shallowEqual(
      a.newBankDraft as Record<string, unknown> | null,
      b.newBankDraft as Record<string, unknown> | null
    )
  );
}

function draftSnapshotFromData(data: ProfileData): DraftState {
  return {
    assignment: data.assignment,
    componentDrafts: Object.fromEntries(
      data.components.map(({ component }) => [
        component.id,
        {
          id: component.id,
          assignmentId: component.assignment_id,
          salaryComponentId: component.salary_component_id,
          amount: component.amount,
          mode: component.mode,
          percentageBase: component.percentage_base ?? 'base-salary',
          attendanceMetric: component.attendance_metric ?? 'payable-days',
          taxable: component.taxable,
          effectiveFrom: component.effective_from,
          effectiveTo: component.effective_to ?? ''
        }
      ])
    ),
    taxDrafts: Object.fromEntries(
      data.taxProfiles.map((tax) => [
        tax.id,
        {
          id: tax.id,
          taxSettingId: tax.tax_setting_id ?? undefined,
          taxIdentifier: tax.tax_identifier ?? '',
          filingStatus: tax.filing_status ?? '',
          employmentStatus: tax.employment_status as TaxDraft['employmentStatus'],
          ptkpStatus: tax.ptkp_status as TaxDraft['ptkpStatus'],
          residency: tax.residency as TaxDraft['residency'],
          taxFacility: tax.tax_facility as TaxDraft['taxFacility'],
          taxObjectCode: tax.tax_object_code as TaxDraft['taxObjectCode'],
          pph21Method: (tax.pph21_method ?? '') as TaxDraft['pph21Method'],
          effectiveFrom: tax.effective_from,
          effectiveTo: tax.effective_to ?? ''
        }
      ])
    ),
    benefitDrafts: Object.fromEntries(
      data.benefits.map((benefit) => [
        benefit.id,
        {
          id: benefit.id,
          benefitCode: benefit.benefit_code,
          benefitName: benefit.benefit_name,
          amount: benefit.amount ?? '',
          status: benefit.status === 'inactive' ? 'inactive' : 'active',
          effectiveFrom: benefit.effective_from,
          effectiveTo: benefit.effective_to ?? ''
        }
      ])
    ),
    bankDrafts: Object.fromEntries(
      data.bankAccounts.map((bank) => [
        bank.id,
        {
          id: bank.id,
          bankName: bank.bank_name,
          accountName: bank.account_name,
          accountNumber: '',
          isPrimary: bank.is_primary,
          effectiveFrom: bank.effective_from,
          effectiveTo: bank.effective_to ?? ''
        }
      ])
    ),
    newComponentDraft: null,
    newTaxDraft: null,
    newBenefitDraft: null,
    newBankDraft: null
  };
}

function ProfileSkeleton() {
  return (
    <div className='animate-pulse space-y-4'>
      <div className='bg-muted h-9 w-full rounded-md' />
      <div className='bg-muted h-40 w-full rounded-lg' />
      <div className='bg-muted h-40 w-full rounded-lg' />
    </div>
  );
}

function ProfilePage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canEdit = canPayrollAction(permissions, isAdmin, 'edit');
  const employeesQuery = useQuery(employeesQueryOptions({ page: 1, limit: 100, status: 'active' }));
  const componentDefinitionsQuery = useQuery(salaryComponentsQueryOptions());
  const [employeeId, setEmployeeId] = useState('');
  const profile = useQuery({
    ...employeePayrollProfileQueryOptions(employeeId),
    enabled: Boolean(employeeId)
  });
  const update = useUpdateEmployeePayrollProfile();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [componentDrafts, setComponentDrafts] = useState<Record<number, ComponentDraft>>({});
  const [taxDrafts, setTaxDrafts] = useState<Record<number, TaxDraft>>({});
  const [benefitDrafts, setBenefitDrafts] = useState<Record<number, BenefitDraft>>({});
  const [bankDrafts, setBankDrafts] = useState<Record<number, BankDraft>>({});
  const [newTaxDraft, setNewTaxDraft] = useState<TaxDraft | null>(null);
  const [newBenefitDraft, setNewBenefitDraft] = useState<BenefitDraft | null>(null);
  const [newBankDraft, setNewBankDraft] = useState<BankDraft | null>(null);
  const [newComponentDraft, setNewComponentDraft] = useState<ComponentDraft | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<Assignment | null>(null);
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null);
  const [bpjsDirty, setBpjsDirty] = useState(false);
  const baselineRef = useRef<DraftState | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!employeeId && employeesQuery.data?.employees[0])
      setEmployeeId(employeesQuery.data.employees[0].id);
  }, [employeeId, employeesQuery.data?.employees]);
  const data = profile.data as ProfileData | undefined;
  useEffect(() => {
    if (!data) return;
    const snapshot = draftSnapshotFromData(data);
    setAssignment(snapshot.assignment);
    setComponentDrafts(snapshot.componentDrafts);
    setTaxDrafts(snapshot.taxDrafts);
    setBenefitDrafts(snapshot.benefitDrafts);
    setBankDrafts(snapshot.bankDrafts);
    baselineRef.current = snapshot;
    setDirty(false);
  }, [data]);

  const currentSnapshot = useMemo<DraftState>(
    () => ({
      assignment,
      componentDrafts,
      taxDrafts,
      benefitDrafts,
      bankDrafts,
      newComponentDraft,
      newTaxDraft,
      newBenefitDraft,
      newBankDraft
    }),
    [
      assignment,
      componentDrafts,
      taxDrafts,
      benefitDrafts,
      bankDrafts,
      newComponentDraft,
      newTaxDraft,
      newBenefitDraft,
      newBankDraft
    ]
  );

  useEffect(() => {
    if (!baselineRef.current) return;
    setDirty(!snapshotsEqual(currentSnapshot, baselineRef.current));
  }, [currentSnapshot]);

  const handleEmployeeChange = (value: string) => {
    if (dirty || bpjsDirty) {
      setPendingEmployeeId(value);
      return;
    }
    setEmployeeId(value);
  };

  const resetDrafts = (snapshot?: DraftState | null) => {
    const next = snapshot ?? (data ? draftSnapshotFromData(data) : currentSnapshot);
    setAssignment(next.assignment);
    setComponentDrafts(next.componentDrafts);
    setTaxDrafts(next.taxDrafts);
    setBenefitDrafts(next.benefitDrafts);
    setBankDrafts(next.bankDrafts);
    setNewComponentDraft(null);
    setNewTaxDraft(null);
    setNewBenefitDraft(null);
    setNewBankDraft(null);
    baselineRef.current = next;
    setDirty(false);
  };

  const revertComponent = (id: number) => {
    if (!data) return;
    setComponentDrafts((prev) => ({
      ...prev,
      [id]: draftSnapshotFromData(data).componentDrafts[id]
    }));
  };
  const revertTax = (id: number) => {
    if (!data) return;
    setTaxDrafts((prev) => ({ ...prev, [id]: draftSnapshotFromData(data).taxDrafts[id] }));
  };
  const revertBenefit = (id: number) => {
    if (!data) return;
    setBenefitDrafts((prev) => ({ ...prev, [id]: draftSnapshotFromData(data).benefitDrafts[id] }));
  };
  const revertBank = (id: number) => {
    if (!data) return;
    setBankDrafts((prev) => ({ ...prev, [id]: draftSnapshotFromData(data).bankDrafts[id] }));
  };

  const save = async (payload: ProfileMutation) => {
    try {
      await update.mutateAsync(payload);
      if (payload.kind === 'component') setNewComponentDraft(null);
      if (payload.kind === 'tax') setNewTaxDraft(null);
      if (payload.kind === 'benefit') setNewBenefitDraft(null);
      if (payload.kind === 'bank') setNewBankDraft(null);
      toast.success(t('payroll.saved'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  const saveAssignment = () => {
    if (!pendingAssignment) return;
    setPendingAssignment(null);
    const current = pendingAssignment;
    if (!validDates(current.effective_from, current.effective_to ?? ''))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'assignment',
      values: {
        id: profileRecordId(current.id),
        salaryType: current.salary_type,
        amount: current.amount,
        effectiveFrom: current.effective_from,
        effectiveTo: current.effective_to ?? undefined,
        departmentId: current.department_id ?? undefined,
        designationId: current.designation_id ?? undefined
      }
    });
  };
  const requestSalarySave = () => {
    if (!assignment || !validDates(assignment.effective_from, assignment.effective_to ?? ''))
      return toast.error(t('payroll.invalidProfile'));
    setPendingAssignment(assignment);
  };
  const saveComponent = (draft: ComponentDraft) => {
    if (!validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'component',
      values: {
        id: profileRecordId(draft.id),
        assignmentId: draft.assignmentId,
        salaryComponentId: draft.salaryComponentId,
        amount: draft.amount,
        mode: draft.mode,
        percentageBase: draft.percentageBase,
        attendanceMetric: draft.attendanceMetric,
        taxable: draft.taxable,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      }
    });
  };
  const saveTax = (draft: TaxDraft) => {
    if (!validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'tax',
      values: {
        id: profileRecordId(draft.id),
        taxSettingId: draft.taxSettingId,
        taxIdentifier: draft.taxIdentifier || undefined,
        filingStatus: draft.filingStatus || undefined,
        employmentStatus: draft.employmentStatus || undefined,
        ptkpStatus: draft.ptkpStatus || undefined,
        residency: draft.residency || undefined,
        taxFacility: draft.taxFacility || undefined,
        taxObjectCode: draft.taxObjectCode || undefined,
        pph21Method: draft.pph21Method || undefined,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      }
    });
  };
  const saveBenefit = (draft: BenefitDraft) => {
    if (!validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'benefit',
      values: {
        id: profileRecordId(draft.id),
        benefitCode: draft.benefitCode,
        benefitName: draft.benefitName,
        amount: draft.amount || undefined,
        status: draft.status,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      }
    });
  };
  const saveBank = (draft: BankDraft) => {
    if (!draft.accountNumber || !validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.bankAccountRequired'));
    void save({
      employeeId,
      kind: 'bank',
      values: {
        id: profileRecordId(draft.id),
        bankName: draft.bankName,
        accountName: draft.accountName,
        accountNumber: draft.accountNumber,
        isPrimary: draft.isPrimary,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      }
    });
  };
  const selectedAssignmentId =
    assignment?.id && assignment.id > 0 ? assignment.id : data?.assignments[0]?.id;
  const selectedEmployee = employeesQuery.data?.employees.find((e) => e.id === employeeId);

  const salaryLabel = (salaryType: string) =>
    t(
      `payroll.${salaryType === 'daily' ? 'daily' : salaryType === 'hourly' ? 'hourly' : 'monthly'}`
    );

  return (
    <PageContainer
      pageTitle={t('payroll.profile')}
      pageDescription={t('payroll.profileDescription')}
    >
      <div className='space-y-4'>
        <Card>
          <CardContent className='pt-6'>
            {employeesQuery.isLoading ? (
              <ProfileSkeleton />
            ) : employeesQuery.isError ? (
              <p className='text-sm text-destructive'>{t('payroll.employeeLoadFailed')}</p>
            ) : (
              <div className='grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end'>
                <div>
                  <Label htmlFor='profile-employee'>{t('payroll.employee')}</Label>
                  <NativeSelect
                    id='profile-employee'
                    className='mt-1'
                    value={employeeId}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                  >
                    <option value=''>{t('payroll.selectEmployee')}</option>
                    {(employeesQuery.data?.employees ?? []).map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {t('payroll.employeeOption', {
                          name: employee.full_name,
                          code: employee.employee_code
                        })}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {selectedEmployee && assignment?.amount ? (
                  <div className='rounded-md border bg-muted/30 px-3 py-2 text-sm'>
                    <span className='text-muted-foreground'>
                      {t('payroll.currentSalaryLabel')}{' '}
                    </span>
                    <span className='font-medium'>
                      {salaryLabel(assignment.salary_type)} {formatPayrollMoney(assignment.amount)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
        {!employeeId ? (
          <p className='text-sm text-muted-foreground'>{t('payroll.selectEmployee')}</p>
        ) : profile.isLoading ? (
          <ProfileSkeleton />
        ) : profile.isError ? (
          <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
        ) : !data ? (
          <p className='text-sm text-muted-foreground'>{t('payroll.noProfile')}</p>
        ) : (
          <>
            <Tabs defaultValue={'salary'} className='w-full'>
              <TabsList className='flex w-full justify-start overflow-x-auto'>
                <TabsTrigger value='salary' className='shrink-0'>
                  {t('payroll.salaryAssignment')}
                </TabsTrigger>
                <TabsTrigger value='components' className='shrink-0'>
                  {t('payroll.components')}
                </TabsTrigger>
                <TabsTrigger value='tax' className='shrink-0'>
                  {t('payroll.pph21')}
                </TabsTrigger>
                <TabsTrigger value='bpjs' className='shrink-0'>
                  {t('payroll.bpjs')}
                </TabsTrigger>
                <TabsTrigger value='bank' className='shrink-0'>
                  {t('payroll.bankHistory')}
                </TabsTrigger>
                <TabsTrigger value='history' className='shrink-0'>
                  {t('payroll.paymentHistory')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value='salary' className='space-y-3'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('payroll.salaryAssignment')}</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    {assignment ? (
                      <>
                        <div>
                          <Label htmlFor='assignment-salary-type'>{t('payroll.salaryType')}</Label>
                          <NativeSelect
                            id='assignment-salary-type'
                            className='mt-1'
                            disabled={!canEdit}
                            value={assignment.salary_type}
                            onChange={(e) =>
                              setAssignment({
                                ...assignment,
                                salary_type: e.target.value as Assignment['salary_type']
                              })
                            }
                          >
                            <option value='monthly'>{t('payroll.monthly')}</option>
                            <option value='daily'>{t('payroll.daily')}</option>
                            <option value='hourly'>{t('payroll.hourly')}</option>
                          </NativeSelect>
                        </div>
                        <div>
                          <Label htmlFor='assignment-amount'>{t('payroll.amount')}</Label>
                          <Input
                            id='assignment-amount'
                            disabled={!canEdit}
                            value={assignment.amount}
                            onChange={(e) =>
                              setAssignment({ ...assignment, amount: e.target.value })
                            }
                          />
                        </div>
                        <div className='grid gap-3 sm:grid-cols-2'>
                          <div>
                            <Label htmlFor='assignment-effective-from'>
                              {t('payroll.effectiveFrom')}
                            </Label>
                            <DatePicker
                              id='assignment-effective-from'
                              disabled={!canEdit}
                              value={assignment.effective_from}
                              onChange={(date) =>
                                setAssignment({ ...assignment, effective_from: date ?? '' })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='assignment-effective-to'>
                              {t('payroll.effectiveTo')}
                            </Label>
                            <DatePicker
                              id='assignment-effective-to'
                              disabled={!canEdit}
                              value={assignment.effective_to ?? undefined}
                              onChange={(date) =>
                                setAssignment({ ...assignment, effective_to: date || null })
                              }
                            />
                          </div>
                        </div>
                        <div className='flex gap-2'>
                          <Button
                            disabled={!canEdit || update.isPending}
                            onClick={requestSalarySave}
                          >
                            {t('common.save')}
                          </Button>
                          {dirty && (
                            <Button
                              variant='ghost'
                              disabled={!canEdit || update.isPending}
                              onClick={() => resetDrafts()}
                            >
                              {t('common.cancel')}
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <Button
                        disabled={!canEdit}
                        onClick={() =>
                          setAssignment({
                            id: 0,
                            employee_id: employeeId,
                            salary_type: 'monthly',
                            amount: '',
                            effective_from: '',
                            effective_to: null,
                            department_id: null,
                            designation_id: null
                          })
                        }
                      >
                        {t('payroll.addProfile')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value='components' className='space-y-3'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('payroll.components')}</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    {data.components.length === 0 || newComponentDraft ? (
                      newComponentDraft ? (
                        <>
                          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                            <div>
                              <Label htmlFor='new-component-definition'>
                                {t('payroll.component')}
                              </Label>
                              <NativeSelect
                                id='new-component-definition'
                                disabled={!canEdit}
                                className='mt-1'
                                value={newComponentDraft.salaryComponentId || ''}
                                onChange={(e) =>
                                  setNewComponentDraft({
                                    ...newComponentDraft,
                                    salaryComponentId: Number(e.target.value)
                                  })
                                }
                              >
                                <option value=''>{t('payroll.selectComponent')}</option>
                                {(componentDefinitionsQuery.data ?? []).map((definition) => (
                                  <option key={definition.id} value={definition.id}>
                                    {definition.name}
                                  </option>
                                ))}
                              </NativeSelect>
                            </div>
                            <div>
                              <Label htmlFor='new-component-amount'>{t('payroll.amount')}</Label>
                              <Input
                                id='new-component-amount'
                                className='mt-1'
                                disabled={!canEdit}
                                placeholder={t('payroll.amount')}
                                value={newComponentDraft.amount}
                                onChange={(e) =>
                                  setNewComponentDraft({
                                    ...newComponentDraft,
                                    amount: e.target.value
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor='new-component-mode'>{t('payroll.mode')}</Label>
                              <NativeSelect
                                id='new-component-mode'
                                disabled={!canEdit}
                                className='mt-1'
                                value={newComponentDraft.mode}
                                onChange={(e) =>
                                  setNewComponentDraft({
                                    ...newComponentDraft,
                                    mode: e.target.value as ComponentDraft['mode']
                                  })
                                }
                              >
                                <option value='fixed'>{t('payroll.fixed')}</option>
                                <option value='percentage'>{t('payroll.percentage')}</option>
                                <option value='per-attendance'>{t('payroll.perAttendance')}</option>
                              </NativeSelect>
                            </div>
                            <div>
                              <Label htmlFor='new-component-taxable'>{t('payroll.taxable')}</Label>
                              <div className='mt-1 flex h-10 items-center'>
                                <input
                                  id='new-component-taxable'
                                  type='checkbox'
                                  disabled={!canEdit}
                                  checked={newComponentDraft.taxable}
                                  onChange={(e) =>
                                    setNewComponentDraft({
                                      ...newComponentDraft,
                                      taxable: e.target.checked
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor='new-component-effective-from'>
                                {t('payroll.effectiveFrom')}
                              </Label>
                              <DatePicker
                                id='new-component-effective-from'
                                className='mt-1'
                                disabled={!canEdit}
                                value={newComponentDraft.effectiveFrom}
                                onChange={(date) =>
                                  setNewComponentDraft({
                                    ...newComponentDraft,
                                    effectiveFrom: date ?? ''
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor='new-component-effective-to'>
                                {t('payroll.effectiveTo')}
                              </Label>
                              <DatePicker
                                id='new-component-effective-to'
                                className='mt-1'
                                disabled={!canEdit}
                                value={newComponentDraft.effectiveTo}
                                onChange={(date) =>
                                  setNewComponentDraft({
                                    ...newComponentDraft,
                                    effectiveTo: date ?? ''
                                  })
                                }
                              />
                            </div>
                            <div className='flex items-end gap-2'>
                              <Button
                                disabled={!canEdit || update.isPending || !selectedAssignmentId}
                                onClick={() => saveComponent(newComponentDraft)}
                              >
                                {t('common.save')}
                              </Button>
                              <Button
                                variant='ghost'
                                disabled={!canEdit}
                                onClick={() => setNewComponentDraft(null)}
                              >
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                          {newComponentDraft.mode === 'percentage' ? (
                            <div>
                              <Label htmlFor='new-component-percentage-base'>
                                {t('payroll.percentageBase')}
                              </Label>
                              <NativeSelect
                                id='new-component-percentage-base'
                                disabled={!canEdit}
                                value={newComponentDraft.percentageBase}
                                onChange={(e) =>
                                  setNewComponentDraft({
                                    ...newComponentDraft,
                                    percentageBase: e.target
                                      .value as ComponentDraft['percentageBase']
                                  })
                                }
                              >
                                <option value='base-salary'>{t('payroll.baseSalary')}</option>
                                <option value='gross-salary'>{t('payroll.grossSalary')}</option>
                              </NativeSelect>
                            </div>
                          ) : null}
                          {newComponentDraft.mode === 'per-attendance' ? (
                            <div>
                              <Label htmlFor='new-component-attendance-metric'>
                                {t('payroll.attendanceMetric')}
                              </Label>
                              <NativeSelect
                                id='new-component-attendance-metric'
                                disabled={!canEdit}
                                value={newComponentDraft.attendanceMetric}
                                onChange={(e) =>
                                  setNewComponentDraft({
                                    ...newComponentDraft,
                                    attendanceMetric: e.target
                                      .value as ComponentDraft['attendanceMetric']
                                  })
                                }
                              >
                                <option value='payable-days'>{t('payroll.payableDays')}</option>
                                <option value='worked-hours'>{t('payroll.workedHours')}</option>
                                <option value='late-count'>{t('payroll.lateCount')}</option>
                              </NativeSelect>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <Button
                          disabled={!canEdit || !selectedAssignmentId}
                          onClick={() =>
                            setNewComponentDraft({
                              assignmentId: selectedAssignmentId ?? 0,
                              salaryComponentId: 0,
                              amount: '',
                              mode: 'fixed',
                              percentageBase: 'base-salary',
                              attendanceMetric: 'payable-days',
                              taxable: false,
                              effectiveFrom: '',
                              effectiveTo: ''
                            })
                          }
                        >
                          {t('payroll.addComponent')}
                        </Button>
                      )
                    ) : (
                      <>
                        <Button
                          disabled={!canEdit || !selectedAssignmentId}
                          onClick={() =>
                            setNewComponentDraft({
                              assignmentId: selectedAssignmentId ?? 0,
                              salaryComponentId: 0,
                              amount: '',
                              mode: 'fixed',
                              percentageBase: 'base-salary',
                              attendanceMetric: 'payable-days',
                              taxable: false,
                              effectiveFrom: '',
                              effectiveTo: ''
                            })
                          }
                        >
                          {t('payroll.addComponent')}
                        </Button>
                        {data.components.map(({ component, definition }) => {
                          const draft = componentDrafts[component.id];
                          if (!draft) return null;
                          return (
                            <div className='space-y-2 rounded-lg border p-3' key={component.id}>
                              <div className='flex items-center justify-between'>
                                <span className='font-medium'>{definition.name}</span>
                                <Badge variant='outline'>{t(`payroll.${definition.type}`)}</Badge>
                              </div>
                              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                                <div>
                                  <Label htmlFor={`component-amount-${component.id}`}>
                                    {t('payroll.amount')}
                                  </Label>
                                  <Input
                                    id={`component-amount-${component.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.amount}
                                    onChange={(e) =>
                                      setComponentDrafts({
                                        ...componentDrafts,
                                        [component.id]: { ...draft, amount: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`component-mode-${component.id}`}>
                                    {t('payroll.mode')}
                                  </Label>
                                  <NativeSelect
                                    id={`component-mode-${component.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.mode}
                                    onChange={(e) =>
                                      setComponentDrafts({
                                        ...componentDrafts,
                                        [component.id]: {
                                          ...draft,
                                          mode: e.target.value as ComponentDraft['mode']
                                        }
                                      })
                                    }
                                  >
                                    <option value='fixed'>{t('payroll.fixed')}</option>
                                    <option value='percentage'>{t('payroll.percentage')}</option>
                                    <option value='per-attendance'>
                                      {t('payroll.perAttendance')}
                                    </option>
                                  </NativeSelect>
                                </div>
                                <div>
                                  <Label htmlFor={`component-taxable-${component.id}`}>
                                    {t('payroll.taxable')}
                                  </Label>
                                  <div className='mt-1 flex h-10 items-center'>
                                    <input
                                      id={`component-taxable-${component.id}`}
                                      type='checkbox'
                                      disabled={!canEdit}
                                      checked={draft.taxable}
                                      onChange={(e) =>
                                        setComponentDrafts({
                                          ...componentDrafts,
                                          [component.id]: {
                                            ...draft,
                                            taxable: e.target.checked
                                          }
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label htmlFor={`component-effective-from-${component.id}`}>
                                    {t('payroll.effectiveFrom')}
                                  </Label>
                                  <DatePicker
                                    id={`component-effective-from-${component.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.effectiveFrom}
                                    onChange={(date) =>
                                      setComponentDrafts({
                                        ...componentDrafts,
                                        [component.id]: { ...draft, effectiveFrom: date ?? '' }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`component-effective-to-${component.id}`}>
                                    {t('payroll.effectiveTo')}
                                  </Label>
                                  <DatePicker
                                    id={`component-effective-to-${component.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.effectiveTo}
                                    onChange={(date) =>
                                      setComponentDrafts({
                                        ...componentDrafts,
                                        [component.id]: { ...draft, effectiveTo: date ?? '' }
                                      })
                                    }
                                  />
                                </div>
                              </div>
                              {draft.mode === 'percentage' ? (
                                <div>
                                  <Label htmlFor={`component-percentage-base-${component.id}`}>
                                    {t('payroll.percentageBase')}
                                  </Label>
                                  <NativeSelect
                                    id={`component-percentage-base-${component.id}`}
                                    disabled={!canEdit}
                                    value={draft.percentageBase}
                                    onChange={(e) =>
                                      setComponentDrafts({
                                        ...componentDrafts,
                                        [component.id]: {
                                          ...draft,
                                          percentageBase: e.target
                                            .value as ComponentDraft['percentageBase']
                                        }
                                      })
                                    }
                                  >
                                    <option value='base-salary'>{t('payroll.baseSalary')}</option>
                                    <option value='gross-salary'>{t('payroll.grossSalary')}</option>
                                  </NativeSelect>
                                </div>
                              ) : draft.mode === 'per-attendance' ? (
                                <div>
                                  <Label htmlFor={`component-attendance-metric-${component.id}`}>
                                    {t('payroll.attendanceMetric')}
                                  </Label>
                                  <NativeSelect
                                    id={`component-attendance-metric-${component.id}`}
                                    disabled={!canEdit}
                                    value={draft.attendanceMetric}
                                    onChange={(e) =>
                                      setComponentDrafts({
                                        ...componentDrafts,
                                        [component.id]: {
                                          ...draft,
                                          attendanceMetric: e.target
                                            .value as ComponentDraft['attendanceMetric']
                                        }
                                      })
                                    }
                                  >
                                    <option value='payable-days'>{t('payroll.payableDays')}</option>
                                    <option value='worked-hours'>{t('payroll.workedHours')}</option>
                                    <option value='late-count'>{t('payroll.lateCount')}</option>
                                  </NativeSelect>
                                </div>
                              ) : null}
                              <div className='flex gap-2'>
                                <Button
                                  disabled={!canEdit || update.isPending}
                                  size='sm'
                                  onClick={() => saveComponent(draft)}
                                >
                                  {t('common.save')}
                                </Button>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  disabled={!canEdit}
                                  onClick={() => revertComponent(component.id)}
                                >
                                  {t('payroll.revert')}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value='tax' className='space-y-3'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('payroll.pph21')}</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    {data.taxProfiles.length === 0 || newTaxDraft ? (
                      newTaxDraft ? (
                        <div className='grid gap-3 sm:grid-cols-2'>
                          <div>
                            <Label htmlFor='new-tax-identifier'>{t('payroll.taxIdentifier')}</Label>
                            <Input
                              id='new-tax-identifier'
                              className='mt-1'
                              disabled={!canEdit}
                              placeholder={t('payroll.taxIdentifier')}
                              value={newTaxDraft.taxIdentifier}
                              onChange={(e) =>
                                setNewTaxDraft({ ...newTaxDraft, taxIdentifier: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-tax-filing-status'>
                              {t('payroll.filingStatus')}
                            </Label>
                            <Input
                              id='new-tax-filing-status'
                              className='mt-1'
                              disabled={!canEdit}
                              placeholder={t('payroll.filingStatus')}
                              value={newTaxDraft.filingStatus}
                              onChange={(e) =>
                                setNewTaxDraft({ ...newTaxDraft, filingStatus: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-tax-effective-from'>
                              {t('payroll.effectiveFrom')}
                            </Label>
                            <DatePicker
                              id='new-tax-effective-from'
                              className='mt-1'
                              disabled={!canEdit}
                              value={newTaxDraft.effectiveFrom}
                              onChange={(date) =>
                                setNewTaxDraft({ ...newTaxDraft, effectiveFrom: date ?? '' })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-tax-effective-to'>{t('payroll.effectiveTo')}</Label>
                            <DatePicker
                              id='new-tax-effective-to'
                              className='mt-1'
                              disabled={!canEdit}
                              value={newTaxDraft.effectiveTo}
                              onChange={(date) =>
                                setNewTaxDraft({ ...newTaxDraft, effectiveTo: date ?? '' })
                              }
                            />
                          </div>
                          <div className='grid gap-3 sm:col-span-2 sm:grid-cols-3'>
                            <TaxProfileSelects
                              value={newTaxDraft}
                              disabled={!canEdit}
                              onChange={(next) => setNewTaxDraft(next)}
                            />
                          </div>
                          <div className='flex gap-2 sm:col-span-2'>
                            <Button
                              disabled={!canEdit || update.isPending}
                              onClick={() => saveTax(newTaxDraft)}
                            >
                              {t('common.save')}
                            </Button>
                            <Button
                              variant='ghost'
                              disabled={!canEdit}
                              onClick={() => setNewTaxDraft(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          disabled={!canEdit}
                          onClick={() =>
                            setNewTaxDraft({
                              taxIdentifier: '',
                              filingStatus: '',
                              employmentStatus: '',
                              ptkpStatus: '',
                              residency: '',
                              taxFacility: '',
                              taxObjectCode: '',
                              pph21Method: '',
                              effectiveFrom: '',
                              effectiveTo: ''
                            })
                          }
                        >
                          {t('payroll.addTaxRecord')}
                        </Button>
                      )
                    ) : (
                      <>
                        <Button
                          disabled={!canEdit}
                          onClick={() =>
                            setNewTaxDraft({
                              taxIdentifier: '',
                              filingStatus: '',
                              employmentStatus: '',
                              ptkpStatus: '',
                              residency: '',
                              taxFacility: '',
                              taxObjectCode: '',
                              pph21Method: '',
                              effectiveFrom: '',
                              effectiveTo: ''
                            })
                          }
                        >
                          {t('payroll.addTaxRecord')}
                        </Button>
                        {data.taxProfiles.map((tax) => {
                          const draft = taxDrafts[tax.id];
                          if (!draft) return null;
                          return (
                            <div className='space-y-3 rounded-lg border p-3' key={tax.id}>
                              <div className='grid gap-3 sm:grid-cols-2'>
                                <div>
                                  <Label htmlFor={`tax-identifier-${tax.id}`}>
                                    {t('payroll.taxIdentifier')}
                                  </Label>
                                  <Input
                                    id={`tax-identifier-${tax.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    placeholder={t('payroll.taxIdentifier')}
                                    value={draft.taxIdentifier}
                                    onChange={(e) =>
                                      setTaxDrafts({
                                        ...taxDrafts,
                                        [tax.id]: { ...draft, taxIdentifier: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`tax-filing-status-${tax.id}`}>
                                    {t('payroll.filingStatus')}
                                  </Label>
                                  <Input
                                    id={`tax-filing-status-${tax.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    placeholder={t('payroll.filingStatus')}
                                    value={draft.filingStatus}
                                    onChange={(e) =>
                                      setTaxDrafts({
                                        ...taxDrafts,
                                        [tax.id]: { ...draft, filingStatus: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`tax-effective-from-${tax.id}`}>
                                    {t('payroll.effectiveFrom')}
                                  </Label>
                                  <DatePicker
                                    id={`tax-effective-from-${tax.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.effectiveFrom}
                                    onChange={(date) =>
                                      setTaxDrafts({
                                        ...taxDrafts,
                                        [tax.id]: { ...draft, effectiveFrom: date ?? '' }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`tax-effective-to-${tax.id}`}>
                                    {t('payroll.effectiveTo')}
                                  </Label>
                                  <DatePicker
                                    id={`tax-effective-to-${tax.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.effectiveTo}
                                    onChange={(date) =>
                                      setTaxDrafts({
                                        ...taxDrafts,
                                        [tax.id]: { ...draft, effectiveTo: date ?? '' }
                                      })
                                    }
                                  />
                                </div>
                              </div>
                              <TaxProfileSelects
                                value={draft}
                                disabled={!canEdit}
                                onChange={(next) => setTaxDrafts({ ...taxDrafts, [tax.id]: next })}
                              />
                              <div className='flex gap-2'>
                                <Button
                                  disabled={!canEdit || update.isPending}
                                  onClick={() => saveTax(draft)}
                                >
                                  {t('common.save')}
                                </Button>
                                <Button
                                  variant='ghost'
                                  disabled={!canEdit}
                                  onClick={() => revertTax(tax.id)}
                                >
                                  {t('payroll.revert')}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </CardContent>
                </Card>
                <TaxHistoryCard taxRecords={data.taxRecords} />
              </TabsContent>
              <TabsContent value='bpjs' className='space-y-3'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('payroll.bpjs')}</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    {data.benefits.length === 0 || newBenefitDraft ? (
                      newBenefitDraft ? (
                        <div className='grid gap-3 sm:grid-cols-2'>
                          <div>
                            <Label htmlFor='new-benefit-code'>{t('payroll.code')}</Label>
                            <Input
                              id='new-benefit-code'
                              className='mt-1'
                              disabled={!canEdit}
                              placeholder={t('payroll.code')}
                              value={newBenefitDraft.benefitCode}
                              onChange={(e) =>
                                setNewBenefitDraft({
                                  ...newBenefitDraft,
                                  benefitCode: e.target.value
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-benefit-name'>{t('payroll.name')}</Label>
                            <Input
                              id='new-benefit-name'
                              className='mt-1'
                              disabled={!canEdit}
                              placeholder={t('payroll.name')}
                              value={newBenefitDraft.benefitName}
                              onChange={(e) =>
                                setNewBenefitDraft({
                                  ...newBenefitDraft,
                                  benefitName: e.target.value
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-benefit-amount'>{t('payroll.amount')}</Label>
                            <Input
                              id='new-benefit-amount'
                              className='mt-1'
                              disabled={!canEdit}
                              placeholder={t('payroll.amount')}
                              value={newBenefitDraft.amount}
                              onChange={(e) =>
                                setNewBenefitDraft({ ...newBenefitDraft, amount: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-benefit-effective-from'>
                              {t('payroll.effectiveFrom')}
                            </Label>
                            <DatePicker
                              id='new-benefit-effective-from'
                              className='mt-1'
                              disabled={!canEdit}
                              value={newBenefitDraft.effectiveFrom}
                              onChange={(date) =>
                                setNewBenefitDraft({
                                  ...newBenefitDraft,
                                  effectiveFrom: date ?? ''
                                })
                              }
                            />
                          </div>
                          <div className='flex items-end gap-2 sm:col-span-2'>
                            <Button
                              disabled={!canEdit || update.isPending}
                              onClick={() => saveBenefit(newBenefitDraft)}
                            >
                              {t('common.save')}
                            </Button>
                            <Button
                              variant='ghost'
                              disabled={!canEdit}
                              onClick={() => setNewBenefitDraft(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          disabled={!canEdit}
                          onClick={() =>
                            setNewBenefitDraft({
                              benefitCode: '',
                              benefitName: '',
                              amount: '',
                              status: 'active',
                              effectiveFrom: '',
                              effectiveTo: ''
                            })
                          }
                        >
                          {t('payroll.addBenefit')}
                        </Button>
                      )
                    ) : (
                      <>
                        <Button
                          disabled={!canEdit}
                          onClick={() =>
                            setNewBenefitDraft({
                              benefitCode: '',
                              benefitName: '',
                              amount: '',
                              status: 'active',
                              effectiveFrom: '',
                              effectiveTo: ''
                            })
                          }
                        >
                          {t('payroll.addBenefit')}
                        </Button>
                        {data.benefits.map((benefit) => {
                          const draft = benefitDrafts[benefit.id];
                          if (!draft) return null;
                          return (
                            <div className='space-y-3 rounded-lg border p-3' key={benefit.id}>
                              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                                <div>
                                  <Label htmlFor={`benefit-code-${benefit.id}`}>
                                    {t('payroll.code')}
                                  </Label>
                                  <Input
                                    id={`benefit-code-${benefit.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.benefitCode}
                                    onChange={(e) =>
                                      setBenefitDrafts({
                                        ...benefitDrafts,
                                        [benefit.id]: { ...draft, benefitCode: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`benefit-name-${benefit.id}`}>
                                    {t('payroll.name')}
                                  </Label>
                                  <Input
                                    id={`benefit-name-${benefit.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.benefitName}
                                    onChange={(e) =>
                                      setBenefitDrafts({
                                        ...benefitDrafts,
                                        [benefit.id]: { ...draft, benefitName: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`benefit-amount-${benefit.id}`}>
                                    {t('payroll.amount')}
                                  </Label>
                                  <Input
                                    id={`benefit-amount-${benefit.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.amount}
                                    onChange={(e) =>
                                      setBenefitDrafts({
                                        ...benefitDrafts,
                                        [benefit.id]: { ...draft, amount: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`benefit-effective-from-${benefit.id}`}>
                                    {t('payroll.effectiveFrom')}
                                  </Label>
                                  <DatePicker
                                    id={`benefit-effective-from-${benefit.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.effectiveFrom}
                                    onChange={(date) =>
                                      setBenefitDrafts({
                                        ...benefitDrafts,
                                        [benefit.id]: { ...draft, effectiveFrom: date ?? '' }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`benefit-effective-to-${benefit.id}`}>
                                    {t('payroll.effectiveTo')}
                                  </Label>
                                  <DatePicker
                                    id={`benefit-effective-to-${benefit.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.effectiveTo}
                                    onChange={(date) =>
                                      setBenefitDrafts({
                                        ...benefitDrafts,
                                        [benefit.id]: { ...draft, effectiveTo: date ?? '' }
                                      })
                                    }
                                  />
                                </div>
                              </div>
                              <div className='flex gap-2'>
                                <Button
                                  disabled={!canEdit || update.isPending}
                                  onClick={() => saveBenefit(draft)}
                                >
                                  {t('common.save')}
                                </Button>
                                <Button
                                  variant='ghost'
                                  disabled={!canEdit}
                                  onClick={() => revertBenefit(benefit.id)}
                                >
                                  {t('payroll.revert')}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </CardContent>
                </Card>
                <BpjsEnrollmentCard employeeId={employeeId} onDirtyChange={setBpjsDirty} />
              </TabsContent>
              <TabsContent value='bank' className='space-y-3'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('payroll.bankHistory')}</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    {data.bankAccounts.length === 0 || newBankDraft ? (
                      newBankDraft ? (
                        <div className='grid gap-3 sm:grid-cols-2'>
                          <div>
                            <Label htmlFor='new-bank-name'>{t('payroll.bank')}</Label>
                            <Input
                              id='new-bank-name'
                              className='mt-1'
                              disabled={!canEdit}
                              placeholder={t('payroll.bank')}
                              value={newBankDraft.bankName}
                              onChange={(e) =>
                                setNewBankDraft({ ...newBankDraft, bankName: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-bank-account-name'>
                              {t('payroll.accountName')}
                            </Label>
                            <Input
                              id='new-bank-account-name'
                              className='mt-1'
                              disabled={!canEdit}
                              placeholder={t('payroll.accountName')}
                              value={newBankDraft.accountName}
                              onChange={(e) =>
                                setNewBankDraft({ ...newBankDraft, accountName: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-bank-account-number'>
                              {t('payroll.accountNumber')}
                            </Label>
                            <Input
                              id='new-bank-account-number'
                              className='mt-1'
                              disabled={!canEdit}
                              placeholder={t('payroll.accountNumber')}
                              value={newBankDraft.accountNumber}
                              onChange={(e) =>
                                setNewBankDraft({ ...newBankDraft, accountNumber: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor='new-bank-effective-from'>
                              {t('payroll.effectiveFrom')}
                            </Label>
                            <DatePicker
                              id='new-bank-effective-from'
                              className='mt-1'
                              disabled={!canEdit}
                              value={newBankDraft.effectiveFrom}
                              onChange={(date) =>
                                setNewBankDraft({ ...newBankDraft, effectiveFrom: date ?? '' })
                              }
                            />
                          </div>
                          <div className='flex items-end gap-2 sm:col-span-2'>
                            <Button
                              disabled={!canEdit || update.isPending}
                              onClick={() => saveBank(newBankDraft)}
                            >
                              {t('common.save')}
                            </Button>
                            <Button
                              variant='ghost'
                              disabled={!canEdit}
                              onClick={() => setNewBankDraft(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          disabled={!canEdit}
                          onClick={() =>
                            setNewBankDraft({
                              bankName: '',
                              accountName: '',
                              accountNumber: '',
                              isPrimary: true,
                              effectiveFrom: '',
                              effectiveTo: ''
                            })
                          }
                        >
                          {t('payroll.addBankAccount')}
                        </Button>
                      )
                    ) : (
                      <>
                        <Button
                          disabled={!canEdit}
                          onClick={() =>
                            setNewBankDraft({
                              bankName: '',
                              accountName: '',
                              accountNumber: '',
                              isPrimary: true,
                              effectiveFrom: '',
                              effectiveTo: ''
                            })
                          }
                        >
                          {t('payroll.addBankAccount')}
                        </Button>
                        {data.bankAccounts.map((bank) => {
                          const draft = bankDrafts[bank.id];
                          if (!draft) return null;
                          return (
                            <div className='space-y-3 rounded-lg border p-3' key={bank.id}>
                              <p className='text-sm'>
                                {bank.bank_name} {t('payroll.separator')}{' '}
                                {maskBankAccount(bank.account_number)} {t('payroll.separator')}{' '}
                                {bank.account_name}
                              </p>
                              <div className='grid gap-3 sm:grid-cols-2'>
                                <div>
                                  <Label htmlFor={`bank-name-${bank.id}`}>
                                    {t('payroll.bank')}
                                  </Label>
                                  <Input
                                    id={`bank-name-${bank.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.bankName}
                                    onChange={(e) =>
                                      setBankDrafts({
                                        ...bankDrafts,
                                        [bank.id]: { ...draft, bankName: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`bank-account-name-${bank.id}`}>
                                    {t('payroll.accountName')}
                                  </Label>
                                  <Input
                                    id={`bank-account-name-${bank.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.accountName}
                                    onChange={(e) =>
                                      setBankDrafts({
                                        ...bankDrafts,
                                        [bank.id]: { ...draft, accountName: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`bank-account-number-${bank.id}`}>
                                    {t('payroll.accountNumber')}
                                  </Label>
                                  <Input
                                    id={`bank-account-number-${bank.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    placeholder={t('payroll.reenterAccount')}
                                    value={draft.accountNumber}
                                    onChange={(e) =>
                                      setBankDrafts({
                                        ...bankDrafts,
                                        [bank.id]: { ...draft, accountNumber: e.target.value }
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`bank-effective-from-${bank.id}`}>
                                    {t('payroll.effectiveFrom')}
                                  </Label>
                                  <DatePicker
                                    id={`bank-effective-from-${bank.id}`}
                                    className='mt-1'
                                    disabled={!canEdit}
                                    value={draft.effectiveFrom}
                                    onChange={(date) =>
                                      setBankDrafts({
                                        ...bankDrafts,
                                        [bank.id]: { ...draft, effectiveFrom: date ?? '' }
                                      })
                                    }
                                  />
                                </div>
                                <div className='flex items-end gap-2 sm:col-span-2'>
                                  <Button
                                    disabled={!canEdit || update.isPending}
                                    onClick={() => saveBank(draft)}
                                  >
                                    {t('common.save')}
                                  </Button>
                                  <Button
                                    variant='ghost'
                                    disabled={!canEdit}
                                    onClick={() => revertBank(bank.id)}
                                  >
                                    {t('payroll.revert')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value='history' className='space-y-3'>
                <PaymentHistoryCard paymentHistory={data.paymentHistory} />
              </TabsContent>
            </Tabs>
            <p className='text-xs text-muted-foreground'>{t('payroll.profileEditHint')}</p>
          </>
        )}
      </div>
      <Dialog
        open={Boolean(pendingAssignment)}
        onOpenChange={(open) => !open && setPendingAssignment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payroll.confirmSalary')}</DialogTitle>
            <DialogDescription>
              {pendingAssignment
                ? `${salaryLabel(pendingAssignment.salary_type)} ${formatPayrollMoney(pendingAssignment.amount)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='ghost' onClick={() => setPendingAssignment(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={update.isPending} onClick={saveAssignment}>
              {t('payroll.confirmSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pendingEmployeeId !== null}
        onOpenChange={(open) => !open && setPendingEmployeeId(null)}
        title={t('payroll.discardChangesTitle')}
        description={t('payroll.discardChanges')}
        confirmLabel={t('payroll.discard')}
        onConfirm={() => {
          if (pendingEmployeeId !== null) setEmployeeId(pendingEmployeeId);
          setPendingEmployeeId(null);
        }}
      />
      <Block shouldBlockFn={() => dirty || bpjsDirty} enableBeforeUnload withResolver>
        {(blocker) => (
          <ConfirmDialog
            open={blocker.status === 'blocked'}
            onOpenChange={(open) => {
              if (!open && blocker.status === 'blocked') blocker.reset();
            }}
            title={t('payroll.leaveUnsavedTitle')}
            description={t('payroll.leaveUnsaved')}
            confirmLabel={t('payroll.discard')}
            cancelLabel={t('payroll.stay')}
            destructive
            onConfirm={() => blocker.status === 'blocked' && blocker.proceed()}
          />
        )}
      </Block>
    </PageContainer>
  );
}
