import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatPayrollMoney } from './-components';

export type PaymentHistoryRow = {
  id: number;
  period_name: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  net_salary: string;
  period_status: string;
};

export function PaymentHistoryCard({ paymentHistory }: { paymentHistory: PaymentHistoryRow[] }) {
  const { t } = useTranslation();
  return (
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
              {paymentHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='text-center text-muted-foreground'>
                    {t('payroll.noPaymentHistory')}
                  </TableCell>
                </TableRow>
              ) : (
                paymentHistory.map((record) => {
                  const paid = record.period_status === 'paid' || record.period_status === 'locked';
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
  );
}
