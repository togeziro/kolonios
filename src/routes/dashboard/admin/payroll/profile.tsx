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
import { employeePayrollProfileQueryOptions } from '@/features/payroll/api/queries';
import { useUpdateEmployeePayrollProfile } from '@/features/payroll/api/mutations';
import { employeesQueryOptions } from '@/features/employees/api/queries';
import { maskBankAccount } from './components';

export const Route = createFileRoute('/dashboard/admin/payroll/profile')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: ProfilePage
});
function ProfilePage() {
  const { t } = useTranslation();
  const { data: employees } = useQuery(
    employeesQueryOptions({ page: 1, limit: 100, status: 'active' })
  );
  const [employeeId, setEmployeeId] = useState('');
  const profile = useQuery({
    ...employeePayrollProfileQueryOptions(employeeId),
    enabled: Boolean(employeeId)
  });
  const update = useUpdateEmployeePayrollProfile();
  const [assignment, setAssignment] = useState<any>(null);
  useEffect(() => {
    if (!employeeId && employees?.employees?.[0]) setEmployeeId(employees.employees[0].id);
  }, [employeeId, employees]);
  useEffect(() => {
    const row = profile.data?.assignment;
    if (row)
      setAssignment({
        id: row.id,
        salaryType: row.salary_type,
        amount: row.amount,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to ?? ''
      });
  }, [profile.data?.assignment]);
  const save = async () => {
    if (
      !assignment ||
      !employeeId ||
      !assignment.effectiveFrom ||
      !assignment.amount ||
      (assignment.effectiveTo && assignment.effectiveTo < assignment.effectiveFrom)
    )
      return toast.error(t('payroll.invalidProfile'));
    try {
      await update.mutateAsync({
        employeeId,
        kind: 'assignment',
        values: { ...assignment, effectiveTo: assignment.effectiveTo || undefined }
      });
      toast.success(t('payroll.saved'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  const data: any = profile.data;
  return (
    <PageContainer
      pageTitle={t('payroll.profile')}
      pageDescription={t('payroll.profileDescription')}
    >
      <div className='space-y-4'>
        <Card>
          <CardContent className='pt-6'>
            <Label>{t('payroll.employee')}</Label>
            <select
              className='mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm'
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value=''>{t('payroll.selectEmployee')}</option>
              {(employees?.employees ?? []).map((employee: any) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} ({employee.employee_code})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
        {employeeId && (
          <div className='grid gap-4 lg:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.salaryAssignment')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {assignment && (
                  <>
                    <div>
                      <Label>{t('payroll.salaryType')}</Label>
                      <select
                        className='w-full rounded-md border bg-background px-3 py-2 text-sm'
                        value={assignment.salaryType}
                        onChange={(e) =>
                          setAssignment({ ...assignment, salaryType: e.target.value })
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
                        value={assignment.amount}
                        onChange={(e) => setAssignment({ ...assignment, amount: e.target.value })}
                      />
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <div>
                        <Label>{t('payroll.effectiveFrom')}</Label>
                        <Input
                          type='date'
                          value={assignment.effectiveFrom}
                          onChange={(e) =>
                            setAssignment({ ...assignment, effectiveFrom: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>{t('payroll.effectiveTo')}</Label>
                        <Input
                          type='date'
                          value={assignment.effectiveTo}
                          onChange={(e) =>
                            setAssignment({ ...assignment, effectiveTo: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <Button onClick={save} disabled={update.isPending}>
                      {t('common.save')}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.profileSummary')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3 text-sm'>
                {profile.isLoading ? (
                  <p>{t('common.loading')}</p>
                ) : (
                  <>
                    <p>
                      <strong>{t('payroll.taxIdentifier')}:</strong>{' '}
                      {data?.tax?.tax_identifier ?? '-'}
                    </p>
                    <p>
                      <strong>{t('payroll.filingStatus')}:</strong>{' '}
                      {data?.tax?.filing_status ?? '-'}
                    </p>
                    <p>
                      <strong>{t('payroll.bank')}:</strong>{' '}
                      {data?.bank
                        ? `${data.bank.bank_name} • ${maskBankAccount(data.bank.account_number)}`
                        : '-'}
                    </p>
                    <p>
                      <strong>{t('payroll.components')}:</strong> {(data?.components ?? []).length}
                    </p>
                    <p>
                      <strong>{t('payroll.benefits')}:</strong> {(data?.benefits ?? []).length}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
