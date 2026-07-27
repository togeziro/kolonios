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
import { toast } from 'sonner';
import { STATUS_OPTIONS } from './customer-tables/options';

export function CustomerFormSheet({ customer, open, onOpenChange }: CustomerFormSheetProps) {
  const isEdit = !!customer;

  const createMutation = useMutation({
    ...createCustomerMutation,
    onSuccess: () => {
      toast.success('Customer created successfully');
      onOpenChange(false);
      form.reset();
    },
    onError: () => toast.error('Failed to create customer')
  });

  const updateMutation = useMutation({
    ...updateCustomerMutation,
    onSuccess: () => {
      toast.success('Customer updated successfully');
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to update customer')
  });

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
          <SheetTitle>{isEdit ? 'Edit Customer' : 'New Customer'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the customer details below.'
              : 'Fill in the details to create a new customer.'}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          <form.AppForm>
            <form.Form id='customer-form-sheet' className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FormTextField name='full_name' label='Full Name' required placeholder='John Doe' />

                <FormTextField
                  name='email'
                  label='Email'
                  required
                  type='email'
                  placeholder='john@example.com'
                />

                <FormTextField name='phone' label='Phone' required placeholder='+1234567890' />

                <FormTextField
                  name='id_card_number'
                  label='ID Card Number'
                  placeholder='ID card number'
                />

                <FormTextField
                  name='latitude'
                  label='Latitude'
                  type='number'
                  step='any'
                  placeholder='-6.2088'
                />

                <FormTextField
                  name='longitude'
                  label='Longitude'
                  type='number'
                  step='any'
                  placeholder='106.8456'
                />
              </div>

              <FormTextField
                name='address'
                label='Address'
                placeholder='Street, city, postal code'
              />

              <FormTextField
                name='billing_address'
                label='Billing Address'
                placeholder='Billing address if different'
              />

              <FormTextareaField
                name='notes'
                label='Notes'
                placeholder='Additional notes...'
                rows={2}
              />

              <FormTextareaField
                name='service_data'
                label='Service Data (JSON)'
                placeholder='{"pppoe_username": "user1", "plan": "100Mbps"}'
                rows={3}
              />

              <FormSelectField
                name='status'
                label='Status'
                required
                options={STATUS_OPTIONS}
                placeholder='Select status'
              />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='submit' form='customer-form-sheet' isLoading={isPending}>
            <Icons.check /> {isEdit ? 'Update Customer' : 'Create Customer'}
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Add Customer
      </Button>
      <CustomerFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
