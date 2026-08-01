import { useState } from 'react';
import { useStore } from '@tanstack/react-form';
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
import { Icons } from '@/components/icons';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createEmployeeMutation, updateEmployeeMutation } from '../api/mutations';
import type { Employee } from '../api/types';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { STATUS_OPTIONS, EMPLOYMENT_STATUS_OPTIONS } from './employee-tables/options';
import {
  departmentsQueryOptions,
  designationOptionsQueryOptions
} from '@/features/masterdata/api/queries';

export function EmployeeFormSheet({ employee, open, onOpenChange }: EmployeeFormSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!employee;

  const { data: deptData } = useSuspenseQuery(departmentsQueryOptions());
  const { data: desigData } = useSuspenseQuery(designationOptionsQueryOptions());

  const createMutation = useMutation(
    mergeMutationCallbacks(createEmployeeMutation, {
      onSuccess: () => {
        toast.success(t('employee.created'));
        onOpenChange(false);
        form.reset();
      },
      onError: () => toast.error(t('employee.createFailed'))
    })
  );

  const updateMutation = useMutation(
    mergeMutationCallbacks(updateEmployeeMutation, {
      onSuccess: () => {
        toast.success(t('employee.updated'));
        onOpenChange(false);
      },
      onError: () => toast.error(t('employee.updateFailed'))
    })
  );

  const form = useAppForm({
    defaultValues: {
      full_name: employee?.full_name ?? '',
      nickname: employee?.nickname ?? '',
      email: employee?.email ?? '',
      phone: employee?.phone ?? '',
      birth_place: employee?.birth_place ?? '',
      birth_date: employee?.birth_date ?? '',
      address: employee?.address ?? '',
      id_number: employee?.id_number ?? '',
      department_id: employee ? String(employee.department_id) : '',
      designation_id: employee ? String(employee.designation_id) : '',
      is_internship: employee?.is_internship ?? false,
      employment_status: employee?.employment_status ?? 'active',
      join_date: employee?.join_date ?? '',
      leave_date: employee?.leave_date ?? '',
      base_salary: employee ? String(employee.base_salary) : '0',
      status: employee?.status ?? 'active'
    } as EmployeeFormValues,
    onSubmit: async ({ value }) => {
      const payload = {
        full_name: value.full_name,
        nickname: value.nickname || '',
        email: value.email,
        phone: value.phone || '',
        birth_place: value.birth_place || '',
        birth_date: value.birth_date,
        address: value.address || '',
        id_number: value.id_number || '',
        department_id: Number(value.department_id),
        designation_id: Number(value.designation_id),
        is_internship: value.is_internship || false,
        employment_status: value.employment_status || 'active',
        join_date: value.join_date,
        leave_date: value.leave_date || null,
        base_salary: Number(value.base_salary) || 0,
        status: value.status || 'active'
      };
      if (isEdit) {
        await updateMutation.mutateAsync({ id: employee.id, values: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    }
  });

  const { FormTextField, FormSelectField, FormCheckboxField } = useFormFields<EmployeeFormValues>();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const departments = deptData?.departments ?? [];
  const deptOptions = departments.map((d: { id: number; name: string }) => ({
    value: String(d.id),
    label: d.name
  }));

  const designationOptions = desigData?.options ?? [];
  const formValues = useStore(form.store, (state) => state.values);
  const isInternship = formValues.is_internship;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? t('employee.edit') : t('employee.new')}</SheetTitle>
          <SheetDescription>
            {isEdit ? t('employee.editDescription') : t('employee.newDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          <form.AppForm>
            <form.Form id='employee-form-sheet' className='space-y-4'>
              <div className='space-y-2'>
                <h4 className='text-sm font-medium text-muted-foreground'>
                  {t('employee.personal')}
                </h4>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <FormTextField
                    name='full_name'
                    label={t('employee.fullName')}
                    required
                    placeholder={t('employee.namePlaceholder')}
                  />

                  <FormTextField
                    name='nickname'
                    label={t('employee.nickname')}
                    placeholder={t('employee.nicknamePlaceholder')}
                  />

                  <FormTextField
                    name='email'
                    label={t('employee.email')}
                    required
                    type='email'
                    placeholder={t('employee.emailPlaceholder')}
                  />

                  <FormTextField
                    name='phone'
                    label={t('employee.phone')}
                    placeholder='+1234567890'
                  />

                  <FormTextField
                    name='birth_place'
                    label={t('employee.birthPlace')}
                    placeholder={t('employee.cityPlaceholder')}
                  />

                  <FormTextField
                    name='birth_date'
                    label={t('employee.birthDate')}
                    required
                    placeholder={t('employee.datePlaceholder')}
                  />

                  <FormTextField
                    name='address'
                    label={t('employee.address')}
                    placeholder={t('employee.addressPlaceholder')}
                  />

                  <FormTextField
                    name='id_number'
                    label={t('employee.idNumber')}
                    placeholder={t('employee.idNumberPlaceholder')}
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <h4 className='text-sm font-medium text-muted-foreground'>
                  {t('employee.employment')}
                </h4>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <FormSelectField
                    name='department_id'
                    label={t('employee.department')}
                    required
                    options={deptOptions}
                    placeholder={t('employee.selectDepartment')}
                  />

                  <FormSelectField
                    name='designation_id'
                    label={t('employee.designation')}
                    required
                    options={designationOptions}
                    placeholder={t('employee.selectDesignation')}
                  />

                  <FormTextField
                    name='join_date'
                    label={t('employee.joinDate')}
                    required
                    placeholder={t('employee.datePlaceholder')}
                  />

                  <FormSelectField
                    name='employment_status'
                    label={t('employee.employmentStatus')}
                    options={EMPLOYMENT_STATUS_OPTIONS}
                    placeholder={t('employee.selectStatus')}
                  />

                  <FormCheckboxField name='is_internship' label={t('employee.internship')} />

                  {!isInternship && (
                    <FormTextField
                      name='leave_date'
                      label={t('employee.leaveDate')}
                      placeholder={t('employee.datePlaceholder')}
                    />
                  )}
                </div>
              </div>

              <div className='space-y-2'>
                <h4 className='text-sm font-medium text-muted-foreground'>
                  {t('employee.salary')}
                </h4>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <FormTextField
                    name='base_salary'
                    label={t('employee.baseSalary')}
                    type='number'
                    placeholder='5000000'
                  />
                </div>
              </div>

              {isEdit && (
                <FormSelectField
                  name='status'
                  label={t('employee.status')}
                  required
                  options={STATUS_OPTIONS}
                  placeholder={t('employee.selectStatus')}
                />
              )}
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type='submit' form='employee-form-sheet' isLoading={isPending}>
            <Icons.check /> {isEdit ? t('employee.updateEmployee') : t('employee.createEmployee')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface EmployeeFormSheetProps {
  employee?: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EmployeeFormValues = {
  full_name: string;
  nickname: string;
  email: string;
  phone: string;
  birth_place: string;
  birth_date: string;
  address: string;
  id_number: string;
  department_id: string;
  designation_id: string;
  is_internship: boolean;
  employment_status: string;
  join_date: string;
  leave_date: string;
  base_salary: string;
  status: string;
};

export function EmployeeFormSheetTrigger() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> {t('employee.add')}
      </Button>
      <EmployeeFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
