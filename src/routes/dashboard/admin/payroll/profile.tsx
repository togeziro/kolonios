import { useState } from 'react';
import { Block, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
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
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { formatPayrollMoney } from './-components';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type ProfileData, profileRecordId } from './-profile-types';
import { useProfileDrafts } from './-profile-drafts';
import {
  SalaryAssignmentTab,
  ComponentsTab,
  TaxTab,
  BpjsTab,
  BankTab,
  HistoryTab,
  type TabContext
} from './-profile-tabs';

export { profileRecordId };

export const Route = createFileRoute('/dashboard/admin/payroll/profile')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: ProfilePage
});

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
  const employees = employeesQuery.data?.employees;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  // Fall back to the first employee until an explicit selection is made
  // (derived instead of effect-synced; same stable result without the extra
  // render pass).
  const employeeId = selectedEmployeeId || employees?.[0]?.id || '';
  const profile = useQuery({
    ...employeePayrollProfileQueryOptions(employeeId),
    enabled: Boolean(employeeId)
  });
  const update = useUpdateEmployeePayrollProfile();
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null);
  const data = profile.data as ProfileData | undefined;

  const drafts = useProfileDrafts({
    data,
    employeeId,
    update: {
      mutateAsync: update.mutateAsync,
      isPending: update.isPending
    }
  });

  const handleEmployeeChange = (value: string) => {
    if (drafts.dirty || drafts.bpjsDirty) {
      setPendingEmployeeId(value);
      return;
    }
    setSelectedEmployeeId(value);
  };

  const selectedAssignmentId =
    drafts.assignment?.id && drafts.assignment.id > 0
      ? drafts.assignment.id
      : data?.assignments[0]?.id;
  const selectedEmployee = employeesQuery.data?.employees.find((e) => e.id === employeeId);

  const salaryLabel = (salaryType: string) =>
    t(
      `payroll.${salaryType === 'daily' ? 'daily' : salaryType === 'hourly' ? 'hourly' : 'monthly'}`
    );

  const tabContext: TabContext = {
    t,
    canEdit,
    isPending: update.isPending,
    data: data as ProfileData,
    employeeId,
    selectedAssignmentId,
    salaryLabel,
    componentDefinitions: {
      data: componentDefinitionsQuery.data as { id: number; name: string }[] | undefined
    },
    ...drafts
  };

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
                {selectedEmployee && drafts.assignment?.amount ? (
                  <div className='rounded-md border bg-muted/30 px-3 py-2 text-sm'>
                    <span className='text-muted-foreground'>
                      {t('payroll.currentSalaryLabel')}{' '}
                    </span>
                    <span className='font-medium'>
                      {salaryLabel(drafts.assignment.salary_type)}{' '}
                      {formatPayrollMoney(drafts.assignment.amount)}
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
                <SalaryAssignmentTab {...tabContext} />
              </TabsContent>
              <TabsContent value='components' className='space-y-3'>
                <ComponentsTab {...tabContext} />
              </TabsContent>
              <TabsContent value='tax' className='space-y-3'>
                <TaxTab {...tabContext} />
              </TabsContent>
              <TabsContent value='bpjs' className='space-y-3'>
                <BpjsTab {...tabContext} />
              </TabsContent>
              <TabsContent value='bank' className='space-y-3'>
                <BankTab {...tabContext} />
              </TabsContent>
              <TabsContent value='history' className='space-y-3'>
                <HistoryTab {...tabContext} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
      <Dialog
        open={Boolean(drafts.pendingAssignment)}
        onOpenChange={(open) => !open && drafts.setPendingAssignment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payroll.confirmSalary')}</DialogTitle>
            <DialogDescription>
              {drafts.pendingAssignment
                ? `${salaryLabel(drafts.pendingAssignment.salary_type)} ${formatPayrollMoney(drafts.pendingAssignment.amount)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='ghost' onClick={() => drafts.setPendingAssignment(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={update.isPending} onClick={drafts.saveAssignment}>
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
          if (pendingEmployeeId !== null) setSelectedEmployeeId(pendingEmployeeId);
          setPendingEmployeeId(null);
        }}
      />
      <Block shouldBlockFn={() => drafts.dirty || drafts.bpjsDirty} enableBeforeUnload withResolver>
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
