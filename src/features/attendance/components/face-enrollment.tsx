import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { FaceCapture } from './face-capture';
import { enrollFaceFn, clearFaceEnrollmentFn } from '@/features/face/api/service';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { faceKeys } from '@/features/face/api/queries';

export function FaceEnrollment() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCapture = useCallback((descriptor: number[]) => {
    // Keep a small set of captures for a more robust enrollment.
    setDescriptors((prev) => {
      if (
        prev.some((d) => d.length === descriptor.length && d.every((v, i) => v === descriptor[i]))
      ) {
        return prev;
      }
      const next = [...prev, descriptor];
      return next.slice(-3);
    });
  }, []);

  const handleEnroll = async () => {
    if (descriptors.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await enrollFaceFn({ data: { descriptors } });
      setDescriptors([]);
      await queryClient.invalidateQueries({ queryKey: faceKeys.enrollment() });
      toast.success(t('faceEnrollment.enrolled'));
    } catch {
      toast.error(t('faceEnrollment.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await clearFaceEnrollmentFn();
      setDescriptors([]);
      await queryClient.invalidateQueries({ queryKey: faceKeys.enrollment() });
      toast.success(t('faceEnrollment.cleared'));
    } catch {
      toast.error(t('faceEnrollment.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <p className='text-sm text-zinc-400'>{t('faceEnrollment.description')}</p>
        <div className='flex items-center gap-2'>
          <Icons.shield className='h-4 w-4 text-green-500' />
          <span className='text-sm'>
            {t('faceEnrollment.captures', { count: descriptors.length })}
          </span>
        </div>
      </div>

      <FaceCapture onCapture={(descriptor) => handleCapture(descriptor)} />

      <div className='flex gap-2'>
        <Button
          className='flex-1'
          onClick={handleEnroll}
          disabled={descriptors.length === 0 || isSubmitting}
        >
          {isSubmitting ? t('common.saving') : t('faceEnrollment.enrollButton')}
        </Button>
        <Button variant='outline' onClick={handleClear} disabled={isSubmitting}>
          {t('faceEnrollment.clearButton')}
        </Button>
      </div>
    </div>
  );
}
