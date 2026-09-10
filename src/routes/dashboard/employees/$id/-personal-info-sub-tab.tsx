import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Employee } from '@/features/employees/api/types';
import { formatDate } from '@/lib/format';

interface FieldRow {
  labelKey: string;
  value: string;
}

function FieldGrid({ rows }: { rows: FieldRow[] }) {
  return (
    <dl className='grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2'>
      {rows.map((row) => (
        <div key={row.labelKey} className='flex flex-col gap-1'>
          <dt className='text-muted-foreground text-xs font-medium uppercase tracking-wide'>
            {row.labelKey}
          </dt>
          <dd className='text-sm'>{row.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmployeePersonalInfoSubTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();

  const identityRows: FieldRow[] = [
    { labelKey: t('employee.employeeCode'), value: employee.employee_code },
    { labelKey: t('employee.fullName'), value: employee.full_name },
    { labelKey: t('employee.nickname'), value: employee.nickname },
    { labelKey: t('employee.email'), value: employee.email },
    { labelKey: t('employee.phone'), value: employee.phone }
  ];

  const employmentRows: FieldRow[] = [
    { labelKey: t('employee.department'), value: employee.department_name },
    { labelKey: t('employee.designation'), value: employee.designation_name },
    { labelKey: t('employee.joinDate'), value: formatDate(employee.join_date) },
    { labelKey: t('employee.leaveDate'), value: formatDate(employee.leave_date ?? '') },
    { labelKey: t('employee.employmentStatus'), value: employee.employment_status },
    {
      labelKey: t('employee.internship'),
      value: employee.is_internship ? t('common.yes') : t('common.no')
    },
    { labelKey: t('employee.status'), value: employee.status }
  ];

  return (
    <div className='flex flex-col gap-4'>
      <Card>
        <CardHeader>
          <CardTitle>{t('employee.identitySection')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGrid rows={identityRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('employee.employmentSection')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGrid rows={employmentRows} />
        </CardContent>
      </Card>
    </div>
  );
}
