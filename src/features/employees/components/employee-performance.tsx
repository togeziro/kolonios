import { useSuspenseQuery } from '@tanstack/react-query';
import { performanceStatsQueryOptions } from '@/features/attendance/api/queries';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

export function EmployeePerformance() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(performanceStatsQueryOptions());

  const reports = data?.reports ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('employee.performance')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.date')}</TableHead>
              <TableHead>{t('employee.score')}</TableHead>
              <TableHead>{t('employee.runningAverage')}</TableHead>
              <TableHead>{t('employee.notes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className='text-center text-muted-foreground'>
                  {t('employee.noPerformance')}
                </TableCell>
              </TableRow>
            ) : (
              reports.map(
                (report: {
                  id: number;
                  date: string;
                  score: string | null;
                  running_average: string | null;
                  notes: string | null;
                }) => (
                  <TableRow key={report.id}>
                    <TableCell>{report.date}</TableCell>
                    <TableCell>{report.score ?? '-'}</TableCell>
                    <TableCell>{report.running_average ?? '-'}</TableCell>
                    <TableCell>{report.notes ?? '-'}</TableCell>
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function EmployeePerformanceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className='bg-muted h-6 w-48 animate-pulse rounded' />
      </CardHeader>
      <CardContent>
        <div className='flex animate-pulse flex-col gap-2'>
          <div className='bg-muted h-8 w-full rounded' />
          <div className='bg-muted h-8 w-full rounded' />
          <div className='bg-muted h-8 w-full rounded' />
        </div>
      </CardContent>
    </Card>
  );
}
