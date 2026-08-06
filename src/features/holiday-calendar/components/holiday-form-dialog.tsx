import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useCreateNationalHoliday, useUpdateNationalHoliday } from '../api/mutations';
import type { NationalHoliday } from '@/lib/db/schema/attendance';
import { Icons } from '@/components/icons';
import { useEffect } from 'react';
import { useAppForm } from '@/components/ui/tanstack-form';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface HolidayFormDialogProps {
  holiday?: NationalHoliday;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HolidayFormDialog({ holiday, open, onOpenChange }: HolidayFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!holiday;
  const createMutation = useCreateNationalHoliday();
  const updateMutation = useUpdateNationalHoliday();

  const form = useAppForm({
    defaultValues: {
      date: holiday?.date ?? '',
      name: holiday?.name ?? '',
      description: holiday?.description ?? '',
      is_recurring: holiday?.is_recurring ?? false
    },
    onSubmit: async ({ value }) => {
      try {
        if (isEdit) {
          await updateMutation.mutateAsync({
            id: holiday.id,
            data: {
              date: value.date || undefined,
              name: value.name || undefined,
              description: value.description || undefined,
              is_recurring: value.is_recurring
            }
          });
          toast.success(t('holiday.updated'));
        } else {
          await createMutation.mutateAsync({
            date: value.date,
            name: value.name,
            description: value.description || null,
            is_recurring: value.is_recurring
          });
          toast.success(t('holiday.created'));
        }
        onOpenChange(false);
      } catch {
        toast.error(t('holiday.saveFailed'));
      }
    }
  });

  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, holiday, form]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('holiday.editHoliday') : t('holiday.addHoliday')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('holiday.editHolidayDescription') : t('holiday.addHolidayDescription')}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className='flex flex-col gap-4'
        >
          <form.AppField name='date'>
            {(field) => (
              <div className='flex flex-col gap-2'>
                <Label htmlFor={field.name}>{t('holiday.date')}</Label>
                <Input
                  id={field.name}
                  type='date'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                />
                {field.state.meta.errors.length > 0 && (
                  <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.AppField>

          <form.AppField name='name'>
            {(field) => (
              <div className='flex flex-col gap-2'>
                <Label htmlFor={field.name}>{t('holiday.name')}</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('holiday.namePlaceholder')}
                  required
                />
                {field.state.meta.errors.length > 0 && (
                  <p className='text-destructive text-sm'>{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.AppField>

          <form.AppField name='description'>
            {(field) => (
              <div className='flex flex-col gap-2'>
                <Label htmlFor={field.name}>{t('holiday.description')}</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('holiday.descriptionPlaceholder')}
                  rows={3}
                />
              </div>
            )}
          </form.AppField>

          <form.AppField name='is_recurring'>
            {(field) => (
              <div className='flex items-center gap-2'>
                <Checkbox
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked === true)}
                />
                <Label htmlFor={field.name} className='font-normal'>
                  {t('holiday.isRecurring')}
                </Label>
              </div>
            )}
          </form.AppField>

          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit]) => (
                <Button type='submit' disabled={!canSubmit || isPending}>
                  {isPending && <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />}
                  {isEdit ? t('common.update') : t('common.create')}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
