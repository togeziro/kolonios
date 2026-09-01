import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ShiftListRow } from './shift-columns';

type ShiftDeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftListRow;
  loading?: boolean;
  onConfirm: () => void;
};

export function ShiftDeleteConfirmDialog({
  open,
  onOpenChange,
  shift,
  loading,
  onConfirm
}: ShiftDeleteConfirmDialogProps) {
  const { t } = useTranslation();
  const copy = shift.used
    ? {
        title: t('attendanceAdmin.shiftDeleteConfirmDeactivateTitle'),
        description: t('attendanceAdmin.shiftDeleteConfirmDeactivateDescription', {
          name: shift.name
        }),
        confirmLabel: t('attendanceAdmin.shiftDeleteConfirmDeactivateAction')
      }
    : {
        title: t('attendanceAdmin.shiftDeleteConfirmPermanentTitle'),
        description: t('attendanceAdmin.shiftDeleteConfirmPermanentDescription', {
          name: shift.name
        }),
        confirmLabel: t('attendanceAdmin.shiftDeleteConfirmPermanentAction')
      };
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      destructive
      loading={loading}
      onConfirm={onConfirm}
    />
  );
}
