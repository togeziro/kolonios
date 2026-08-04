import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { createPayslipPdf, type PayslipData } from './payslip-template';

export function downloadPayslip(payslip: PayslipData) {
  return createPayslipPdf(payslip).then(({ bytes, filename }) => {
    const url = URL.createObjectURL(
      new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
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
    try {
      await downloadPayslip(payslip);
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
