import { useState } from 'react';
import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';

import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { employeeByIdQueryOptions } from '@/features/employees/api/queries';
import { EmployeeProfileTab } from './$id/-profile-tab';
import { EmployeeAttendanceTab } from './$id/-attendance-tab';

type TopTab = 'profile' | 'attendance';

export const Route = createFileRoute('/dashboard/employees/$id')({
  head: () => ({ meta: [{ title: 'Dashboard: Employee' }] }),
  ssr: 'data-only',
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(employeeByIdQueryOptions(params.id));
  },
  component: EmployeeDetailRoute
});

function EmployeeDetailRoute() {
  const { t } = useTranslation();
  const { id } = useParams({ from: '/dashboard/employees/$id' });
  const { data, isLoading, isError } = useQuery(employeeByIdQueryOptions(id));
  const employee = data?.employee;

  const [tab, setTab] = useState<TopTab>('profile');

  return (
    <PageContainer
      pageTitle={employee?.full_name ?? t('employee.title')}
      pageDescription={employee ? `${employee.employee_code} · ${employee.email}` : ''}
      isLoading={isLoading}
      pageHeaderAction={
        <Button variant='ghost' size='sm' asChild>
          <Link to='/dashboard/employees'>
            <ChevronLeft className='h-4 w-4' /> {t('common.back')}
          </Link>
        </Button>
      }
    >
      {isError || !employee ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          {t('employee.notFound')}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as TopTab)} className='w-full'>
          <TabsList>
            <TabsTrigger value='profile'>{t('employee.tab.profile')}</TabsTrigger>
            <TabsTrigger value='attendance'>{t('employee.tab.attendance')}</TabsTrigger>
          </TabsList>
          <TabsContent value='profile' className='mt-4'>
            <EmployeeProfileTab employee={employee} />
          </TabsContent>
          <TabsContent value='attendance' className='mt-4'>
            <EmployeeAttendanceTab />
          </TabsContent>
        </Tabs>
      )}
    </PageContainer>
  );
}
