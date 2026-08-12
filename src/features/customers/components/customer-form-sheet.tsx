import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { generateId } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { useMutation } from '@tanstack/react-query';
import { createCustomerMutation, updateCustomerMutation } from '../api/mutations';
import type { Customer } from '../api/types';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { STATUS_OPTIONS } from './customer-tables/options';

export function CustomerFormSheet({ customer, open, onOpenChange }: CustomerFormSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!customer;

  const createMutation = useMutation(
    mergeMutationCallbacks(createCustomerMutation, {
      onSuccess: () => {
        toast.success(t('customer.created'));
        onOpenChange(false);
        form.reset();
      },
      onError: () => toast.error(t('customer.createFailed'))
    })
  );

  const updateMutation = useMutation(
    mergeMutationCallbacks(updateCustomerMutation, {
      onSuccess: () => {
        toast.success(t('customer.updated'));
        onOpenChange(false);
      },
      onError: () => toast.error(t('customer.updateFailed'))
    })
  );

  const form = useAppForm({
    defaultValues: {
      id: customer?.id ?? generateId(),
      full_name: customer?.full_name ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      latitude: customer?.latitude,
      longitude: customer?.longitude,
      id_card_number: customer?.id_card_number ?? '',
      id_card_photo: customer?.id_card_photo ?? '',
      service_data: customer?.service_data ?? '{}',
      billing_address: customer?.billing_address ?? '',
      notes: customer?.notes ?? '',
      status: customer?.status ?? 'active'
    } as CustomerFormValues,
    onSubmit: async ({ value }) => {
      const payload = {
        id: value.id ?? generateId(),
        full_name: value.full_name,
        email: value.email,
        phone: value.phone,
        address: value.address || '',
        latitude: value.latitude,
        longitude: value.longitude,
        id_card_number: value.id_card_number || '',
        id_card_photo: value.id_card_photo || '',
        service_data: value.service_data || '{}',
        billing_address: value.billing_address || '',
        notes: value.notes || '',
        status: value.status
      };
      if (isEdit) {
        await updateMutation.mutateAsync({ id: customer.id, values: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    }
  });

  const { FormTextField, FormTextareaField, FormSelectField } = useFormFields<CustomerFormValues>();

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? t('customer.edit') : t('customer.new')}</SheetTitle>
          <SheetDescription>
            {isEdit ? t('customer.editDescription') : t('customer.newDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          <form.AppForm>
            <form.Form id='customer-form-sheet' className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FormTextField
                  name='full_name'
                  label={t('customer.fullName')}
                  required
                  placeholder={t('customer.namePlaceholder')}
                />

                <FormTextField
                  name='email'
                  label={t('customer.email')}
                  required
                  type='email'
                  placeholder={t('customer.emailPlaceholder')}
                />

                <FormTextField
                  name='phone'
                  label={t('customer.phone')}
                  required
                  placeholder='+1234567890'
                />

                <FormTextField
                  name='id_card_number'
                  label={t('customer.idCardNumber')}
                  placeholder={t('customer.idCardPlaceholder')}
                />

                <FormTextField
                  name='latitude'
                  label={t('customer.latitude')}
                  type='number'
                  step='any'
                  placeholder='-6.2088'
                />

                <FormTextField
                  name='longitude'
                  label={t('customer.longitude')}
                  type='number'
                  step='any'
                  placeholder='106.8456'
                />
              </div>

              <FormTextField
                name='address'
                label={t('customer.address')}
                placeholder={t('customer.addressPlaceholder')}
              />

              <FormTextField
                name='billing_address'
                label={t('customer.billingAddress')}
                placeholder={t('customer.billingAddressPlaceholder')}
              />

              <FormTextareaField
                name='notes'
                label={t('customer.notes')}
                placeholder={t('customer.notesPlaceholder')}
                rows={2}
              />

              <FormTextareaField
                name='service_data'
                label={t('customer.serviceData')}
                placeholder={t('customer.serviceDataPlaceholder')}
                rows={3}
              />

              <FormSelectField
                name='status'
                label={t('customer.status')}
                required
                options={STATUS_OPTIONS}
                placeholder={t('customer.selectStatus')}
              />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type='submit' form='customer-form-sheet' isLoading={isPending}>
            <Icons.check /> {isEdit ? t('customer.updateCustomer') : t('customer.createCustomer')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface CustomerFormSheetProps {
  customer?: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CustomerFormValues = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  id_card_number: string;
  id_card_photo: string;
  service_data: string;
  billing_address: string;
  notes: string;
  status: string;
};

export function CustomerFormSheetTrigger() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size='sm' onClick={() => setOpen(true)}>
        <Icons.add /> {t('customer.add')}
      </Button>
      <CustomerFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
