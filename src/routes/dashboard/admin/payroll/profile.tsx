import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  employeeBpjsEnrollmentsQueryOptions,
  employeePayrollProfileQueryOptions,
  salaryComponentsQueryOptions
} from '@/features/payroll/api/queries';
import {
  useCreateEmployeeBpjsFamilyMember,
  useDeleteEmployeeBpjsFamilyMember,
  useOverrideEmployeeTaxRecord,
  useUpdateEmployeePayrollProfile,
  useUpsertEmployeeBpjsEnrollment
} from '@/features/payroll/api/mutations';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import { updateEmployeePayrollProfileFn } from '@/features/payroll/api/service';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { maskBankAccount, formatPayrollMoney } from './-components';

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
type TaxRecord = {
  id: number;
  employee_id: string;
  payroll_record_id: number | null;
  tax_period: string;
  taxable_income: string;
  tax_amount: string;
  details: unknown;
  source: 'calculated' | 'manual';
  is_overridden: boolean;
  created_at: string;
};
type PaymentHistoryRow = {
  id: number;
  period_name: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  net_salary: string;
  period_status: string;
};
type BpjsFamilyMember = {
  id: number;
  enrollment_id: number;
  name: string;
  relationship: string;
  birth_date: string | null;
  is_core: boolean;
};
type BpjsEnrollment = {
  id: number;
  employee_id: string;
  program: string;
  membership_number: string;
  registration_date: string | null;
  registered_wage: string;
  jkk_category_override: string | null;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  familyMembers: BpjsFamilyMember[];
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
type TaxDraft = {
  id?: number;
  taxSettingId?: number;
  taxIdentifier: string;
  filingStatus: string;
  employmentStatus: 'permanent' | 'contract' | 'freelance' | '';
  ptkpStatus: 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3' | '';
  residency: 'resident' | 'foreign' | '';
  taxFacility: 'none' | 'dtp' | 'etc' | '';
  taxObjectCode: '21-100-01' | '21-100-02' | '21-100-32' | '';
  pph21Method: 'gross' | 'gross_up' | '';
  effectiveFrom: string;
  effectiveTo: string;
};
type BpjsDraft = {
  id?: number;
  program: 'jkk' | 'jkm' | 'jht' | 'jp' | 'kesehatan';
  registeredWage: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};
type FamilyForm = { name: string; relationship: string; isCore: boolean };
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

const TAX_EMPLOYMENT_STATUS_OPTIONS = ['permanent', 'contract', 'freelance'] as const;
const TAX_PTKP_STATUS_OPTIONS = [
  'TK/0',
  'TK/1',
  'TK/2',
  'TK/3',
  'K/0',
  'K/1',
  'K/2',
  'K/3'
] as const;
const TAX_RESIDENCY_OPTIONS = ['resident', 'foreign'] as const;
const TAX_FACILITY_OPTIONS = ['none', 'dtp', 'etc'] as const;
const TAX_OBJECT_CODE_OPTIONS = ['21-100-01', '21-100-02', '21-100-32'] as const;
const TAX_PPH21_METHOD_OPTIONS = ['gross', 'gross_up'] as const;
const BPJS_PROGRAM_OPTIONS = ['jkk', 'jkm', 'jht', 'jp', 'kesehatan'] as const;

function validDates(from: string, to: string) {
  return Boolean(from) && (!to || from <= to);
}

export function profileRecordId(id: number | undefined) {
  return id && id > 0 ? id : undefined;
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
  const bpjsQuery = useQuery({
    ...employeeBpjsEnrollmentsQueryOptions(employeeId),
    enabled: Boolean(employeeId)
  });
  const update = useUpdateEmployeePayrollProfile();
  const upsertBpjs = useUpsertEmployeeBpjsEnrollment();
  const createMember = useCreateEmployeeBpjsFamilyMember();
  const deleteMember = useDeleteEmployeeBpjsFamilyMember();
  const overrideTax = useOverrideEmployeeTaxRecord();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [componentDrafts, setComponentDrafts] = useState<Record<number, ComponentDraft>>({});
  const [taxDrafts, setTaxDrafts] = useState<Record<number, TaxDraft>>({});
  const [benefitDrafts, setBenefitDrafts] = useState<Record<number, BenefitDraft>>({});
  const [bankDrafts, setBankDrafts] = useState<Record<number, BankDraft>>({});
  const [bpjsDrafts, setBpjsDrafts] = useState<Record<number, BpjsDraft>>({});
  const [newTaxDraft, setNewTaxDraft] = useState<TaxDraft | null>(null);
  const [newBenefitDraft, setNewBenefitDraft] = useState<BenefitDraft | null>(null);
  const [newBankDraft, setNewBankDraft] = useState<BankDraft | null>(null);
  const [newComponentDraft, setNewComponentDraft] = useState<ComponentDraft | null>(null);
  const [newBpjsDraft, setNewBpjsDraft] = useState<BpjsDraft | null>(null);
  const [familyForms, setFamilyForms] = useState<Record<number, FamilyForm>>({});
  const [taxOverrideDrafts, setTaxOverrideDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!employeeId && employeesQuery.data?.employees[0])
      setEmployeeId(employeesQuery.data.employees[0].id);
  }, [employeeId, employeesQuery.data?.employees]);
  const data = profile.data as ProfileData | undefined;
  useEffect(() => {
    if (!data) return;
    setAssignment(data.assignment);
    setComponentDrafts(
      Object.fromEntries(
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
      )
    );
    setTaxDrafts(
      Object.fromEntries(
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
      )
    );
    setBenefitDrafts(
      Object.fromEntries(
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
      )
    );
    setBankDrafts(
      Object.fromEntries(
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
      )
    );
  }, [data]);
  const bpjsEnrollments = bpjsQuery.data as { enrollments: BpjsEnrollment[] } | undefined;
  useEffect(() => {
    if (!bpjsEnrollments) return;
    setBpjsDrafts(
      Object.fromEntries(
        bpjsEnrollments.enrollments.map((enrollment) => [
          enrollment.id,
          {
            id: enrollment.id,
            program: enrollment.program as BpjsDraft['program'],
            registeredWage: enrollment.registered_wage,
            isActive: enrollment.is_active,
            effectiveFrom: enrollment.effective_from,
            effectiveTo: enrollment.effective_to ?? ''
          }
        ])
      )
    );
  }, [bpjsEnrollments]);
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
    if (!assignment || !validDates(assignment.effective_from, assignment.effective_to ?? ''))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'assignment',
      values: {
        id: profileRecordId(assignment.id),
        salaryType: assignment.salary_type,
        amount: assignment.amount,
        effectiveFrom: assignment.effective_from,
        effectiveTo: assignment.effective_to ?? undefined,
        departmentId: assignment.department_id ?? undefined,
        designationId: assignment.designation_id ?? undefined
      }
    });
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
  const saveBpjs = (draft: BpjsDraft) => {
    if (!draft.registeredWage || !validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.invalidProfile'));
    void upsertBpjs
      .mutateAsync({
        employeeId,
        program: draft.program,
        registeredWage: draft.registeredWage,
        isActive: draft.isActive,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      })
      .then(() => {
        setNewBpjsDraft(null);
        toast.success(t('payroll.saved'));
      })
      .catch(() => toast.error(t('payroll.failed')));
  };
  const saveTaxOverride = (record: TaxRecord) => {
    const amount = taxOverrideDrafts[record.id];
    if (!amount) return toast.error(t('payroll.invalidProfile'));
    void overrideTax
      .mutateAsync({ id: record.id, amount })
      .then(() => {
        setTaxOverrideDrafts((prev) => {
          const next = { ...prev };
          delete next[record.id];
          return next;
        });
        toast.success(t('payroll.updated'));
      })
      .catch(() => toast.error(t('payroll.failed')));
  };
  const cancelTaxOverride = (id: number) =>
    setTaxOverrideDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  const addMember = async (enrollmentId: number) => {
    const form = familyForms[enrollmentId];
    if (!form || !form.name.trim() || !form.relationship.trim())
      return toast.error(t('payroll.requiredFields'));
    try {
      await createMember.mutateAsync({
        enrollmentId,
        name: form.name,
        relationship: form.relationship,
        isCore: form.isCore
      });
      setFamilyForms((prev) => ({
        ...prev,
        [enrollmentId]: { name: '', relationship: '', isCore: true }
      }));
      toast.success(t('payroll.saved'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  const removeMember = async (member: BpjsFamilyMember) => {
    if (!window.confirm(t('payroll.deleteConfirm'))) return;
    try {
      await deleteMember.mutateAsync({ id: member.id });
      toast.success(t('payroll.saved'));
    } catch {
      toast.error(t('payroll.failed'));
    }
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
  return (
    <PageContainer
      pageTitle={t('payroll.profile')}
      pageDescription={t('payroll.profileDescription')}
    >
      <div className='space-y-4'>
        <Card>
          <CardContent className='pt-6'>
            {employeesQuery.isLoading ? (
              <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
            ) : employeesQuery.isError ? (
              <p className='text-sm text-destructive'>{t('payroll.employeeLoadFailed')}</p>
            ) : (
              <>
                <Label htmlFor='profile-employee'>{t('payroll.employee')}</Label>
                <select
                  id='profile-employee'
                  className='mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm'
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
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
                </select>
              </>
            )}
          </CardContent>
        </Card>
        {!employeeId ? (
          <p className='text-sm text-muted-foreground'>{t('payroll.selectEmployee')}</p>
        ) : profile.isLoading ? (
          <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
        ) : profile.isError ? (
          <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
        ) : !data ? (
          <p className='text-sm text-muted-foreground'>{t('payroll.noProfile')}</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.salaryAssignment')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {assignment ? (
                  <>
                    <div>
                      <Label>{t('payroll.salaryType')}</Label>
                      <select
                        className='w-full rounded-md border bg-background px-3 py-2 text-sm'
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
                      </select>
                    </div>
                    <div>
                      <Label>{t('payroll.amount')}</Label>
                      <Input
                        disabled={!canEdit}
                        value={assignment.amount}
                        onChange={(e) => setAssignment({ ...assignment, amount: e.target.value })}
                      />
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <div>
                        <Label>{t('payroll.effectiveFrom')}</Label>
                        <Input
                          disabled={!canEdit}
                          type='date'
                          value={assignment.effective_from}
                          onChange={(e) =>
                            setAssignment({ ...assignment, effective_from: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>{t('payroll.effectiveTo')}</Label>
                        <Input
                          disabled={!canEdit}
                          type='date'
                          value={assignment.effective_to ?? ''}
                          onChange={(e) =>
                            setAssignment({ ...assignment, effective_to: e.target.value || null })
                          }
                        />
                      </div>
                    </div>
                    <Button disabled={!canEdit || update.isPending} onClick={saveAssignment}>
                      {t('common.save')}
                    </Button>
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
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.components')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {data.components.length === 0 || newComponentDraft ? (
                  newComponentDraft ? (
                    <div className='grid gap-2 sm:grid-cols-5'>
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
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
                      </select>
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.amount')}
                        value={newComponentDraft.amount}
                        onChange={(e) =>
                          setNewComponentDraft({ ...newComponentDraft, amount: e.target.value })
                        }
                      />
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
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
                      </select>
                      <Input
                        disabled={!canEdit}
                        type='date'
                        value={newComponentDraft.effectiveFrom}
                        onChange={(e) =>
                          setNewComponentDraft({
                            ...newComponentDraft,
                            effectiveFrom: e.target.value
                          })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        type='date'
                        value={newComponentDraft.effectiveTo}
                        onChange={(e) =>
                          setNewComponentDraft({
                            ...newComponentDraft,
                            effectiveTo: e.target.value
                          })
                        }
                      />
                      <Button
                        disabled={!canEdit || update.isPending || !selectedAssignmentId}
                        onClick={() => saveComponent(newComponentDraft)}
                      >
                        {t('common.save')}
                      </Button>
                    </div>
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
                      {t('payroll.addProfile')}
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
                      {t('payroll.addProfile')}
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
                          <div className='grid gap-2 sm:grid-cols-3'>
                            <Input
                              disabled={!canEdit}
                              aria-label={t('payroll.amount')}
                              value={draft.amount}
                              onChange={(e) =>
                                setComponentDrafts({
                                  ...componentDrafts,
                                  [component.id]: { ...draft, amount: e.target.value }
                                })
                              }
                            />
                            <select
                              disabled={!canEdit}
                              className='rounded-md border bg-background px-2 text-sm'
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
                              <option value='per-attendance'>{t('payroll.perAttendance')}</option>
                            </select>
                            <Input
                              disabled={!canEdit}
                              type='date'
                              value={draft.effectiveFrom}
                              onChange={(e) =>
                                setComponentDrafts({
                                  ...componentDrafts,
                                  [component.id]: { ...draft, effectiveFrom: e.target.value }
                                })
                              }
                            />
                            <Input
                              disabled={!canEdit}
                              type='date'
                              value={draft.effectiveTo}
                              onChange={(e) =>
                                setComponentDrafts({
                                  ...componentDrafts,
                                  [component.id]: { ...draft, effectiveTo: e.target.value }
                                })
                              }
                            />
                          </div>
                          <Button
                            disabled={!canEdit || update.isPending}
                            size='sm'
                            onClick={() => saveComponent(draft)}
                          >
                            {t('common.save')}
                          </Button>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.pph21')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {data.taxProfiles.length === 0 || newTaxDraft ? (
                  newTaxDraft ? (
                    <div className='grid gap-2 sm:grid-cols-4'>
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.taxIdentifier')}
                        value={newTaxDraft.taxIdentifier}
                        onChange={(e) =>
                          setNewTaxDraft({ ...newTaxDraft, taxIdentifier: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.filingStatus')}
                        value={newTaxDraft.filingStatus}
                        onChange={(e) =>
                          setNewTaxDraft({ ...newTaxDraft, filingStatus: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        type='date'
                        value={newTaxDraft.effectiveFrom}
                        onChange={(e) =>
                          setNewTaxDraft({ ...newTaxDraft, effectiveFrom: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        type='date'
                        value={newTaxDraft.effectiveTo}
                        onChange={(e) =>
                          setNewTaxDraft({ ...newTaxDraft, effectiveTo: e.target.value })
                        }
                      />
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
                        aria-label={t('payroll.employmentStatus')}
                        value={newTaxDraft.employmentStatus}
                        onChange={(e) =>
                          setNewTaxDraft({
                            ...newTaxDraft,
                            employmentStatus: e.target.value as TaxDraft['employmentStatus']
                          })
                        }
                      >
                        <option value=''>{t('payroll.select')}</option>
                        {TAX_EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {t(`payroll.${option}`)}
                          </option>
                        ))}
                      </select>
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
                        aria-label={t('payroll.ptkpStatus')}
                        value={newTaxDraft.ptkpStatus}
                        onChange={(e) =>
                          setNewTaxDraft({
                            ...newTaxDraft,
                            ptkpStatus: e.target.value as TaxDraft['ptkpStatus']
                          })
                        }
                      >
                        <option value=''>{t('payroll.select')}</option>
                        {TAX_PTKP_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
                        aria-label={t('payroll.residency')}
                        value={newTaxDraft.residency}
                        onChange={(e) =>
                          setNewTaxDraft({
                            ...newTaxDraft,
                            residency: e.target.value as TaxDraft['residency']
                          })
                        }
                      >
                        <option value=''>{t('payroll.select')}</option>
                        {TAX_RESIDENCY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {t(`payroll.${option}`)}
                          </option>
                        ))}
                      </select>
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
                        aria-label={t('payroll.taxFacility')}
                        value={newTaxDraft.taxFacility}
                        onChange={(e) =>
                          setNewTaxDraft({
                            ...newTaxDraft,
                            taxFacility: e.target.value as TaxDraft['taxFacility']
                          })
                        }
                      >
                        <option value=''>{t('payroll.select')}</option>
                        {TAX_FACILITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {t(`payroll.${option}`)}
                          </option>
                        ))}
                      </select>
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
                        aria-label={t('payroll.taxObjectCode')}
                        value={newTaxDraft.taxObjectCode}
                        onChange={(e) =>
                          setNewTaxDraft({
                            ...newTaxDraft,
                            taxObjectCode: e.target.value as TaxDraft['taxObjectCode']
                          })
                        }
                      >
                        <option value=''>{t('payroll.select')}</option>
                        {TAX_OBJECT_CODE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
                        aria-label={t('payroll.pph21Method')}
                        value={newTaxDraft.pph21Method}
                        onChange={(e) =>
                          setNewTaxDraft({
                            ...newTaxDraft,
                            pph21Method: e.target.value as TaxDraft['pph21Method']
                          })
                        }
                      >
                        <option value=''>{t('payroll.select')}</option>
                        {TAX_PPH21_METHOD_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {t(`payroll.${option === 'gross_up' ? 'grossUp' : 'gross'}`)}
                          </option>
                        ))}
                      </select>
                      <Button
                        disabled={!canEdit || update.isPending}
                        onClick={() => saveTax(newTaxDraft)}
                      >
                        {t('common.save')}
                      </Button>
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
                      {t('payroll.addProfile')}
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
                      {t('payroll.addProfile')}
                    </Button>
                    {data.taxProfiles.map((tax) => {
                      const draft = taxDrafts[tax.id];
                      if (!draft) return null;
                      return (
                        <div
                          className='grid gap-2 rounded-lg border p-3 sm:grid-cols-4'
                          key={tax.id}
                        >
                          <Input
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
                          <Input
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
                          <Input
                            disabled={!canEdit}
                            type='date'
                            value={draft.effectiveFrom}
                            onChange={(e) =>
                              setTaxDrafts({
                                ...taxDrafts,
                                [tax.id]: { ...draft, effectiveFrom: e.target.value }
                              })
                            }
                          />
                          <Input
                            disabled={!canEdit}
                            type='date'
                            value={draft.effectiveTo}
                            onChange={(e) =>
                              setTaxDrafts({
                                ...taxDrafts,
                                [tax.id]: { ...draft, effectiveTo: e.target.value }
                              })
                            }
                          />
                          <select
                            disabled={!canEdit}
                            className='rounded-md border bg-background px-2 text-sm'
                            aria-label={t('payroll.employmentStatus')}
                            value={draft.employmentStatus}
                            onChange={(e) =>
                              setTaxDrafts({
                                ...taxDrafts,
                                [tax.id]: {
                                  ...draft,
                                  employmentStatus: e.target.value as TaxDraft['employmentStatus']
                                }
                              })
                            }
                          >
                            <option value=''>{t('payroll.select')}</option>
                            {TAX_EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {t(`payroll.${option}`)}
                              </option>
                            ))}
                          </select>
                          <select
                            disabled={!canEdit}
                            className='rounded-md border bg-background px-2 text-sm'
                            aria-label={t('payroll.ptkpStatus')}
                            value={draft.ptkpStatus}
                            onChange={(e) =>
                              setTaxDrafts({
                                ...taxDrafts,
                                [tax.id]: {
                                  ...draft,
                                  ptkpStatus: e.target.value as TaxDraft['ptkpStatus']
                                }
                              })
                            }
                          >
                            <option value=''>{t('payroll.select')}</option>
                            {TAX_PTKP_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <select
                            disabled={!canEdit}
                            className='rounded-md border bg-background px-2 text-sm'
                            aria-label={t('payroll.residency')}
                            value={draft.residency}
                            onChange={(e) =>
                              setTaxDrafts({
                                ...taxDrafts,
                                [tax.id]: {
                                  ...draft,
                                  residency: e.target.value as TaxDraft['residency']
                                }
                              })
                            }
                          >
                            <option value=''>{t('payroll.select')}</option>
                            {TAX_RESIDENCY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {t(`payroll.${option}`)}
                              </option>
                            ))}
                          </select>
                          <select
                            disabled={!canEdit}
                            className='rounded-md border bg-background px-2 text-sm'
                            aria-label={t('payroll.taxFacility')}
                            value={draft.taxFacility}
                            onChange={(e) =>
                              setTaxDrafts({
                                ...taxDrafts,
                                [tax.id]: {
                                  ...draft,
                                  taxFacility: e.target.value as TaxDraft['taxFacility']
                                }
                              })
                            }
                          >
                            <option value=''>{t('payroll.select')}</option>
                            {TAX_FACILITY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {t(`payroll.${option}`)}
                              </option>
                            ))}
                          </select>
                          <select
                            disabled={!canEdit}
                            className='rounded-md border bg-background px-2 text-sm'
                            aria-label={t('payroll.taxObjectCode')}
                            value={draft.taxObjectCode}
                            onChange={(e) =>
                              setTaxDrafts({
                                ...taxDrafts,
                                [tax.id]: {
                                  ...draft,
                                  taxObjectCode: e.target.value as TaxDraft['taxObjectCode']
                                }
                              })
                            }
                          >
                            <option value=''>{t('payroll.select')}</option>
                            {TAX_OBJECT_CODE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <select
                            disabled={!canEdit}
                            className='rounded-md border bg-background px-2 text-sm'
                            aria-label={t('payroll.pph21Method')}
                            value={draft.pph21Method}
                            onChange={(e) =>
                              setTaxDrafts({
                                ...taxDrafts,
                                [tax.id]: {
                                  ...draft,
                                  pph21Method: e.target.value as TaxDraft['pph21Method']
                                }
                              })
                            }
                          >
                            <option value=''>{t('payroll.select')}</option>
                            {TAX_PPH21_METHOD_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {t(`payroll.${option === 'gross_up' ? 'grossUp' : 'gross'}`)}
                              </option>
                            ))}
                          </select>
                          <Button
                            disabled={!canEdit || update.isPending}
                            onClick={() => saveTax(draft)}
                          >
                            {t('common.save')}
                          </Button>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.taxHistory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('payroll.taxPeriod')}</TableHead>
                        <TableHead className='text-right'>{t('payroll.taxableIncome')}</TableHead>
                        <TableHead className='text-right'>{t('payroll.taxAmount')}</TableHead>
                        <TableHead>{t('payroll.source')}</TableHead>
                        <TableHead className='text-right'>{t('payroll.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.taxRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className='text-center text-muted-foreground'>
                            {t('payroll.noTaxHistory')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.taxRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{record.tax_period}</TableCell>
                            <TableCell className='text-right'>
                              {formatPayrollMoney(record.taxable_income)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatPayrollMoney(record.tax_amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={record.source === 'manual' ? 'secondary' : 'outline'}>
                                {record.source === 'manual'
                                  ? t('payroll.manual')
                                  : t('payroll.calculated')}
                              </Badge>
                            </TableCell>
                            <TableCell className='text-right'>
                              {taxOverrideDrafts[record.id] !== undefined ? (
                                <div className='flex items-center justify-end gap-2'>
                                  <Input
                                    className='w-32'
                                    value={taxOverrideDrafts[record.id]}
                                    onChange={(e) =>
                                      setTaxOverrideDrafts({
                                        ...taxOverrideDrafts,
                                        [record.id]: e.target.value
                                      })
                                    }
                                  />
                                  <Button
                                    size='sm'
                                    disabled={!canEdit || overrideTax.isPending}
                                    onClick={() => saveTaxOverride(record)}
                                  >
                                    {t('common.save')}
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    onClick={() => cancelTaxOverride(record.id)}
                                  >
                                    {t('common.cancel')}
                                  </Button>
                                </div>
                              ) : record.source === 'calculated' && canEdit ? (
                                <Button
                                  size='sm'
                                  variant='outline'
                                  onClick={() =>
                                    setTaxOverrideDrafts({
                                      ...taxOverrideDrafts,
                                      [record.id]: record.tax_amount
                                    })
                                  }
                                >
                                  {t('payroll.override')}
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.bpjs')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {data.benefits.length === 0 || newBenefitDraft ? (
                  newBenefitDraft ? (
                    <div className='grid gap-2 sm:grid-cols-6'>
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.code')}
                        value={newBenefitDraft.benefitCode}
                        onChange={(e) =>
                          setNewBenefitDraft({ ...newBenefitDraft, benefitCode: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.name')}
                        value={newBenefitDraft.benefitName}
                        onChange={(e) =>
                          setNewBenefitDraft({ ...newBenefitDraft, benefitName: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.amount')}
                        value={newBenefitDraft.amount}
                        onChange={(e) =>
                          setNewBenefitDraft({ ...newBenefitDraft, amount: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        type='date'
                        value={newBenefitDraft.effectiveFrom}
                        onChange={(e) =>
                          setNewBenefitDraft({ ...newBenefitDraft, effectiveFrom: e.target.value })
                        }
                      />
                      <Button
                        disabled={!canEdit || update.isPending}
                        onClick={() => saveBenefit(newBenefitDraft)}
                      >
                        {t('common.save')}
                      </Button>
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
                      {t('payroll.addProfile')}
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
                      {t('payroll.addProfile')}
                    </Button>
                    {data.benefits.map((benefit) => {
                      const draft = benefitDrafts[benefit.id];
                      if (!draft) return null;
                      return (
                        <div
                          className='grid gap-2 rounded-lg border p-3 sm:grid-cols-6'
                          key={benefit.id}
                        >
                          <Input
                            disabled={!canEdit}
                            value={draft.benefitCode}
                            onChange={(e) =>
                              setBenefitDrafts({
                                ...benefitDrafts,
                                [benefit.id]: { ...draft, benefitCode: e.target.value }
                              })
                            }
                          />
                          <Input
                            disabled={!canEdit}
                            value={draft.benefitName}
                            onChange={(e) =>
                              setBenefitDrafts({
                                ...benefitDrafts,
                                [benefit.id]: { ...draft, benefitName: e.target.value }
                              })
                            }
                          />
                          <Input
                            disabled={!canEdit}
                            value={draft.amount}
                            onChange={(e) =>
                              setBenefitDrafts({
                                ...benefitDrafts,
                                [benefit.id]: { ...draft, amount: e.target.value }
                              })
                            }
                          />
                          <Input
                            disabled={!canEdit}
                            type='date'
                            value={draft.effectiveFrom}
                            onChange={(e) =>
                              setBenefitDrafts({
                                ...benefitDrafts,
                                [benefit.id]: { ...draft, effectiveFrom: e.target.value }
                              })
                            }
                          />
                          <Input
                            disabled={!canEdit}
                            type='date'
                            value={draft.effectiveTo}
                            onChange={(e) =>
                              setBenefitDrafts({
                                ...benefitDrafts,
                                [benefit.id]: { ...draft, effectiveTo: e.target.value }
                              })
                            }
                          />
                          <Button
                            disabled={!canEdit || update.isPending}
                            onClick={() => saveBenefit(draft)}
                          >
                            {t('common.save')}
                          </Button>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.bpjsEnrollment')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {bpjsQuery.isLoading ? (
                  <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
                ) : bpjsQuery.isError ? (
                  <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
                ) : (bpjsEnrollments?.enrollments.length ?? 0) === 0 || newBpjsDraft ? (
                  newBpjsDraft ? (
                    <div className='grid gap-2 sm:grid-cols-5'>
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
                        value={newBpjsDraft.program}
                        onChange={(e) =>
                          setNewBpjsDraft({
                            ...newBpjsDraft,
                            program: e.target.value as BpjsDraft['program']
                          })
                        }
                      >
                        {BPJS_PROGRAM_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {t(`payroll.${option === 'kesehatan' ? 'bpjsKesehatan' : option}`)}
                          </option>
                        ))}
                      </select>
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.registeredWage')}
                        value={newBpjsDraft.registeredWage}
                        onChange={(e) =>
                          setNewBpjsDraft({ ...newBpjsDraft, registeredWage: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        type='date'
                        value={newBpjsDraft.effectiveFrom}
                        onChange={(e) =>
                          setNewBpjsDraft({ ...newBpjsDraft, effectiveFrom: e.target.value })
                        }
                      />
                      <select
                        disabled={!canEdit}
                        className='rounded-md border bg-background px-2 text-sm'
                        value={newBpjsDraft.isActive ? 'active' : 'inactive'}
                        onChange={(e) =>
                          setNewBpjsDraft({
                            ...newBpjsDraft,
                            isActive: e.target.value === 'active'
                          })
                        }
                      >
                        <option value='active'>{t('common.active')}</option>
                        <option value='inactive'>{t('common.inactive')}</option>
                      </select>
                      <Button
                        disabled={!canEdit || upsertBpjs.isPending}
                        onClick={() => saveBpjs(newBpjsDraft)}
                      >
                        {t('common.save')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      disabled={!canEdit}
                      onClick={() =>
                        setNewBpjsDraft({
                          program: 'jkk',
                          registeredWage: '',
                          isActive: true,
                          effectiveFrom: '',
                          effectiveTo: ''
                        })
                      }
                    >
                      {t('payroll.addProfile')}
                    </Button>
                  )
                ) : (
                  <>
                    <Button
                      disabled={!canEdit}
                      onClick={() =>
                        setNewBpjsDraft({
                          program: 'jkk',
                          registeredWage: '',
                          isActive: true,
                          effectiveFrom: '',
                          effectiveTo: ''
                        })
                      }
                    >
                      {t('payroll.addProfile')}
                    </Button>
                    {bpjsEnrollments?.enrollments.map((enrollment) => {
                      const draft = bpjsDrafts[enrollment.id];
                      if (!draft) return null;
                      const form = familyForms[enrollment.id] ?? {
                        name: '',
                        relationship: '',
                        isCore: true
                      };
                      return (
                        <div className='space-y-2 rounded-lg border p-3' key={enrollment.id}>
                          <div className='flex items-center justify-between'>
                            <span className='font-medium'>
                              {t(
                                `payroll.${enrollment.program === 'kesehatan' ? 'bpjsKesehatan' : enrollment.program}`
                              )}
                            </span>
                            <Badge variant={enrollment.is_active ? 'default' : 'secondary'}>
                              {enrollment.is_active ? t('common.active') : t('common.inactive')}
                            </Badge>
                          </div>
                          <div className='grid gap-1 text-sm text-muted-foreground sm:grid-cols-2'>
                            <span>
                              {`${t('payroll.membershipNumber')}: `}
                              <span className='text-foreground'>
                                {enrollment.membership_number || '—'}
                              </span>
                            </span>
                            <span>
                              {`${t('payroll.registrationDate')}: `}
                              <span className='text-foreground'>
                                {enrollment.registration_date || '—'}
                              </span>
                            </span>
                            <span>
                              {`${t('payroll.registeredWage')}: `}
                              <span className='text-foreground'>
                                {formatPayrollMoney(enrollment.registered_wage)}
                              </span>
                            </span>
                            <span>
                              {`${t('payroll.jkkOverride')}: `}
                              <span className='text-foreground'>
                                {enrollment.jkk_category_override || '—'}
                              </span>
                            </span>
                          </div>
                          <div className='grid gap-2 sm:grid-cols-5'>
                            <select
                              disabled={!canEdit}
                              className='rounded-md border bg-background px-2 text-sm'
                              value={draft.program}
                              onChange={(e) =>
                                setBpjsDrafts({
                                  ...bpjsDrafts,
                                  [enrollment.id]: {
                                    ...draft,
                                    program: e.target.value as BpjsDraft['program']
                                  }
                                })
                              }
                            >
                              {BPJS_PROGRAM_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {t(
                                    `payroll.${option === 'kesehatan' ? 'bpjsKesehatan' : option}`
                                  )}
                                </option>
                              ))}
                            </select>
                            <Input
                              disabled={!canEdit}
                              value={draft.registeredWage}
                              onChange={(e) =>
                                setBpjsDrafts({
                                  ...bpjsDrafts,
                                  [enrollment.id]: { ...draft, registeredWage: e.target.value }
                                })
                              }
                            />
                            <select
                              disabled={!canEdit}
                              className='rounded-md border bg-background px-2 text-sm'
                              value={draft.isActive ? 'active' : 'inactive'}
                              onChange={(e) =>
                                setBpjsDrafts({
                                  ...bpjsDrafts,
                                  [enrollment.id]: {
                                    ...draft,
                                    isActive: e.target.value === 'active'
                                  }
                                })
                              }
                            >
                              <option value='active'>{t('common.active')}</option>
                              <option value='inactive'>{t('common.inactive')}</option>
                            </select>
                            <Input
                              disabled={!canEdit}
                              type='date'
                              value={draft.effectiveFrom}
                              onChange={(e) =>
                                setBpjsDrafts({
                                  ...bpjsDrafts,
                                  [enrollment.id]: { ...draft, effectiveFrom: e.target.value }
                                })
                              }
                            />
                            <Input
                              disabled={!canEdit}
                              type='date'
                              value={draft.effectiveTo}
                              onChange={(e) =>
                                setBpjsDrafts({
                                  ...bpjsDrafts,
                                  [enrollment.id]: { ...draft, effectiveTo: e.target.value }
                                })
                              }
                            />
                            <Button
                              disabled={!canEdit || upsertBpjs.isPending}
                              size='sm'
                              onClick={() => saveBpjs(draft)}
                            >
                              {t('common.save')}
                            </Button>
                          </div>
                          <div className='space-y-2'>
                            <p className='text-sm font-medium'>{t('payroll.familyMembers')}</p>
                            {enrollment.familyMembers.length > 0 ? (
                              <ul className='space-y-1'>
                                {enrollment.familyMembers.map((member) => (
                                  <li
                                    key={member.id}
                                    className='flex items-center justify-between gap-2 text-sm'
                                  >
                                    <span>
                                      {member.name} {t('payroll.separator')} {member.relationship}
                                      {member.is_core ? (
                                        <Badge variant='outline' className='ml-2'>
                                          {t('payroll.isCore')}
                                        </Badge>
                                      ) : null}
                                    </span>
                                    <Button
                                      variant='ghost'
                                      size='sm'
                                      disabled={!canEdit}
                                      onClick={() => removeMember(member)}
                                    >
                                      {t('common.delete')}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className='text-xs text-muted-foreground'>
                                {t('payroll.noFamilyMembers')}
                              </p>
                            )}
                            <div className='flex flex-wrap items-center gap-2'>
                              <Input
                                className='w-40'
                                disabled={!canEdit}
                                placeholder={t('payroll.name')}
                                value={form.name}
                                onChange={(e) =>
                                  setFamilyForms({
                                    ...familyForms,
                                    [enrollment.id]: { ...form, name: e.target.value }
                                  })
                                }
                              />
                              <Input
                                className='w-40'
                                disabled={!canEdit}
                                placeholder={t('payroll.relationship')}
                                value={form.relationship}
                                onChange={(e) =>
                                  setFamilyForms({
                                    ...familyForms,
                                    [enrollment.id]: { ...form, relationship: e.target.value }
                                  })
                                }
                              />
                              <label className='flex items-center gap-2 text-sm'>
                                <input
                                  type='checkbox'
                                  checked={form.isCore}
                                  onChange={(e) =>
                                    setFamilyForms({
                                      ...familyForms,
                                      [enrollment.id]: { ...form, isCore: e.target.checked }
                                    })
                                  }
                                />
                                {t('payroll.isCore')}
                              </label>
                              <Button
                                size='sm'
                                disabled={!canEdit || createMember.isPending}
                                onClick={() => addMember(enrollment.id)}
                              >
                                {t('common.add')}
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
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.bankHistory')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {data.bankAccounts.length === 0 || newBankDraft ? (
                  newBankDraft ? (
                    <div className='grid gap-2 sm:grid-cols-5'>
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.bank')}
                        value={newBankDraft.bankName}
                        onChange={(e) =>
                          setNewBankDraft({ ...newBankDraft, bankName: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.accountName')}
                        value={newBankDraft.accountName}
                        onChange={(e) =>
                          setNewBankDraft({ ...newBankDraft, accountName: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        placeholder={t('payroll.accountNumber')}
                        value={newBankDraft.accountNumber}
                        onChange={(e) =>
                          setNewBankDraft({ ...newBankDraft, accountNumber: e.target.value })
                        }
                      />
                      <Input
                        disabled={!canEdit}
                        type='date'
                        value={newBankDraft.effectiveFrom}
                        onChange={(e) =>
                          setNewBankDraft({ ...newBankDraft, effectiveFrom: e.target.value })
                        }
                      />
                      <Button
                        disabled={!canEdit || update.isPending}
                        onClick={() => saveBank(newBankDraft)}
                      >
                        {t('common.save')}
                      </Button>
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
                      {t('payroll.addProfile')}
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
                      {t('payroll.addProfile')}
                    </Button>
                    {data.bankAccounts.map((bank) => {
                      const draft = bankDrafts[bank.id];
                      if (!draft) return null;
                      return (
                        <div className='space-y-2 rounded-lg border p-3' key={bank.id}>
                          <p className='text-sm'>
                            {bank.bank_name} {t('payroll.separator')}{' '}
                            {maskBankAccount(bank.account_number)} {t('payroll.separator')}{' '}
                            {bank.account_name}
                          </p>
                          <div className='grid gap-2 sm:grid-cols-5'>
                            <Input
                              disabled={!canEdit}
                              value={draft.bankName}
                              onChange={(e) =>
                                setBankDrafts({
                                  ...bankDrafts,
                                  [bank.id]: { ...draft, bankName: e.target.value }
                                })
                              }
                            />
                            <Input
                              disabled={!canEdit}
                              value={draft.accountName}
                              onChange={(e) =>
                                setBankDrafts({
                                  ...bankDrafts,
                                  [bank.id]: { ...draft, accountName: e.target.value }
                                })
                              }
                            />
                            <Input
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
                            <Input
                              disabled={!canEdit}
                              type='date'
                              value={draft.effectiveFrom}
                              onChange={(e) =>
                                setBankDrafts({
                                  ...bankDrafts,
                                  [bank.id]: { ...draft, effectiveFrom: e.target.value }
                                })
                              }
                            />
                            <Button
                              disabled={!canEdit || update.isPending}
                              onClick={() => saveBank(draft)}
                            >
                              {t('common.save')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.paymentHistory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('payroll.period')}</TableHead>
                        <TableHead>{t('payroll.paymentDate')}</TableHead>
                        <TableHead className='text-right'>{t('payroll.thp')}</TableHead>
                        <TableHead>{t('payroll.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.paymentHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className='text-center text-muted-foreground'>
                            {t('payroll.noPaymentHistory')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.paymentHistory.map((record) => {
                          const paid =
                            record.period_status === 'paid' || record.period_status === 'locked';
                          return (
                            <TableRow key={record.id}>
                              <TableCell>{record.period_name}</TableCell>
                              <TableCell>{record.payment_date}</TableCell>
                              <TableCell className='text-right'>
                                {formatPayrollMoney(record.net_salary)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={paid ? 'default' : 'outline'}>
                                  {paid ? t('payroll.paidLabel') : t('payroll.unpaidLabel')}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <p className='text-xs text-muted-foreground'>{t('payroll.profileEditHint')}</p>
          </>
        )}
      </div>
    </PageContainer>
  );
}
