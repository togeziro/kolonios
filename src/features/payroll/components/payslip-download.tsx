import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { createPayslipPdf, type PayslipData, type PayslipPdfLabels } from './payslip-template';

export function downloadPayslip(payslip: PayslipData, labels: PayslipPdfLabels) {
  return createPayslipPdf(payslip, labels).then(({ bytes, filename }) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    // click() resolves the blob URL synchronously and the browser keeps its
    // own Blob reference for the pending download (File API: revocation only
    // blocks future resolutions), so revoking on the next macrotask is safe
    // cross-browser and deterministic — a fixed delay neither protected slow
    // save dialogs nor guaranteed cleanup.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return filename;
  });
}

export function PayslipDownload({ payslip }: { payslip: PayslipData }) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(false);
  const handleDownload = async () => {
    setIsDownloading(true);
    setError(false);
    const labels = {
      payslip: t('payroll.payslips'),
      period: t('payroll.periods'),
      employee: t('payroll.employee'),
      employeeCode: t('payroll.employeeCode'),
      department: t('payroll.department'),
      designation: t('employee.designation'),
      description: t('payroll.description'),
      amount: t('payroll.amount'),
      gross: t('payroll.gross'),
      allowances: t('payroll.allowances'),
      deductions: t('payroll.deductions'),
      tax: t('payroll.tax'),
      net: t('payroll.net'),
      bank: t('payroll.bank')
    };
    try {
      await downloadPayslip(payslip, labels);
    } catch {
      setError(true);
    } finally {
      setIsDownloading(false);
    }
  };
  return (
    <div className='space-y-2'>
      <Button type='button' onClick={() => void handleDownload()} disabled={isDownloading}>
        {isDownloading ? t('payroll.downloading') : t('payroll.download')}
      </Button>
      {error && <p className='text-destructive text-sm'>{t('payroll.downloadFailed')}</p>}
    </div>
  );
}
