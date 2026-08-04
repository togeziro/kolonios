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
import { employeePayrollProfileQueryOptions } from '@/features/payroll/api/queries';
import { salaryComponentsQueryOptions } from '@/features/payroll/api/queries';
import { useUpdateEmployeePayrollProfile } from '@/features/payroll/api/mutations';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import { updateEmployeePayrollProfileFn } from '@/features/payroll/api/service';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { maskBankAccount } from './components';

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
};
type ComponentDraft = {
  id?: number;
  assignmentId: number;
  salaryComponentId: number;
  amount: string;
  effectiveFrom: string;
  effectiveTo: string;
};
type TaxDraft = {
  id?: number;
  taxSettingId?: number;
  taxIdentifier: string;
  filingStatus: string;
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
                      {employee.full_name} ({employee.employee_code})
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
                    <div className='grid gap-2 sm:grid-cols-5'>
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
                          className='grid gap-2 rounded-lg border p-3 sm:grid-cols-5'
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
                            {bank.bank_name} • {maskBankAccount(bank.account_number)} •{' '}
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
            <p className='text-xs text-muted-foreground'>{t('payroll.profileEditHint')}</p>
          </>
        )}
      </div>
    </PageContainer>
  );
}
