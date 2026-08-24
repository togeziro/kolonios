import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useTranslation } from 'react-i18next';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

const emptySubscribe = () => () => {};

export function AlertModal({ isOpen, onClose, onConfirm, loading }: AlertModalProps) {
  const { t } = useTranslation();
  // Render nothing on the server and during hydration; flip after mount so
  // the portal-based Modal never runs its client-only logic during SSR.
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      title={t('confirm.deleteTitle')}
      description={t('confirm.deleteDescription')}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className='flex w-full items-center justify-end space-x-2 pt-6'>
        <Button disabled={loading} variant='outline' onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={loading} variant='destructive' onClick={onConfirm}>
          {t('confirm.deleteConfirm')}
        </Button>
      </div>
    </Modal>
  );
}
