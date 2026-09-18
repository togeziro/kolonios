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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { onboardEmployeeMutation } from '../api/mutations';
import type { OnboardEmployeePayload } from '../api/types';
import { onboardFormSchema, type OnboardFormValues } from '../api/validation';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/lib/errors';
import { ONBOARD_LINK_WITH_PASSWORD } from '@/lib/db/employees';
import { roleGroupsQueryOptions } from '@/features/role-groups/api/queries';
import {
  departmentsQueryOptions,
  designationOptionsQueryOptions
} from '@/features/masterdata/api/queries';

const NO_ROLE_GROUP = 'none';

export function OnboardEmployeeSheet({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  const { data: deptData } = useSuspenseQuery(departmentsQueryOptions());
  const { data: desigData } = useSuspenseQuery(designationOptionsQueryOptions());
  const { data: rgData } = useQuery(roleGroupsQueryOptions());
  const roleGroupsList =
    (rgData as { role_groups?: { id: string; name: string }[] })?.role_groups ?? [];
  const roleGroupOptions = [
    { value: NO_ROLE_GROUP, label: t('user.noRoleGroup') },
    ...roleGroupsList.map((rg) => ({ value: rg.id, label: rg.name }))
  ];

  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const onboardMutation = useMutation(
    mergeMutationCallbacks(onboardEmployeeMutation, {
      onSuccess: (data) => {
        const generated = (data as { generatedPassword?: string; linked?: boolean } | undefined)
          ?.generatedPassword;
        if (generated) {
          setGeneratedPassword(generated);
        } else {
          toast.success(
            (data as { linked?: boolean })?.linked
              ? t('employee.onboardLinked')
              : t('employee.onboarded')
          );
          onOpenChange(false);
        }
        form.reset();
      },
      onError: (error) => {
        const code = (error as { code?: unknown })?.code;
        if (code === ONBOARD_LINK_WITH_PASSWORD) {
          toast.error(t('employee.onboardFailed.linkWithPassword'));
          return;
        }
        const message = getErrorMessage(error) ?? t('employee.onboardFailed');
        toast.error(message);
      }
    })
  );

  const form = useAppForm({
    defaultValues: {
      full_name: '',
      email: '',
      role_group_id: NO_ROLE_GROUP,
      password: '',
      confirmPassword: '',
      birth_date: '',
      department_id: '',
      designation_id: '',
      join_date: ''
    } as OnboardFormValues,
    validators: { onSubmit: onboardFormSchema },
    onSubmit: async ({ value }) => {
      const payload: OnboardEmployeePayload = {
        full_name: value.full_name,
        email: value.email,
        role_group_id: value.role_group_id === NO_ROLE_GROUP ? undefined : value.role_group_id,
        password: value.password?.trim() ? value.password : undefined,
        birth_date: value.birth_date,
        department_id: Number(value.department_id),
        designation_id: Number(value.designation_id),
        join_date: value.join_date
      };
      await onboardMutation.mutateAsync(payload);
    }
  });

  const { FormTextField, FormSelectField } = useFormFields<OnboardFormValues>();

  const isPending = onboardMutation.isPending;

  const departments = deptData?.departments ?? [];
  const deptOptions = departments.map((d: { id: number; name: string }) => ({
    value: String(d.id),
    label: d.name
  }));
  const designationOptions = desigData?.options ?? [];

  async function copyGenerated() {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      toast.success(t('user.passwordCopied'));
    } catch {
      toast.error(t('user.passwordCopyFailed'));
    }
  }

  function closeAfterCredential() {
    toast.success(t('employee.onboarded'));
    setGeneratedPassword(null);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open={generatedPassword !== null}
        onOpenChange={(next) => {
          if (!next) closeAfterCredential();
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('user.generatedPasswordTitle')}</DialogTitle>
            <DialogDescription>{t('user.generatedPasswordDescription')}</DialogDescription>
          </DialogHeader>
          <div className='flex items-center gap-2'>
            <Input readOnly value={generatedPassword ?? ''} className='font-mono' />
            <Button type='button' variant='outline' onClick={copyGenerated}>
              <Icons.copy /> {t('user.copyPassword')}
            </Button>
          </div>
          <DialogFooter>
            <Button type='button' onClick={closeAfterCredential}>
              <Icons.check /> {t('user.generatedPasswordDone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className='flex flex-col sm:max-w-lg'>
          <SheetHeader>
            <SheetTitle>{t('employee.onboard')}</SheetTitle>
            <SheetDescription>{t('employee.onboardDescription')}</SheetDescription>
          </SheetHeader>

          <div className='flex-1 overflow-auto'>
            <form.AppForm>
              <form.Form id='onboard-employee-sheet' className='space-y-4'>
                <div className='space-y-2'>
                  <h4 className='text-sm font-medium text-muted-foreground'>
                    {t('employee.accountSection')}
                  </h4>
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    <FormTextField
                      name='full_name'
                      label={t('employee.fullName')}
                      required
                      placeholder={t('employee.namePlaceholder')}
                    />
                    <FormTextField
                      name='email'
                      label={t('employee.email')}
                      required
                      type='email'
                      placeholder={t('employee.emailPlaceholder')}
                    />
                    <FormSelectField
                      name='role_group_id'
                      label={t('user.accessLevel')}
                      required
                      options={roleGroupOptions}
                      placeholder={t('user.selectAccessLevel')}
                    />
                    <div className='hidden sm:block' />
                    <FormTextField
                      name='password'
                      label={t('user.password')}
                      type='password'
                      autoComplete='new-password'
                      placeholder={t('user.passwordOptionalPlaceholder')}
                    />
                    <FormTextField
                      name='confirmPassword'
                      label={t('user.confirmPassword')}
                      type='password'
                      autoComplete='new-password'
                    />
                  </div>
                  <p className='text-muted-foreground text-sm'>
                    {t('user.optionalPasswordNotice')}
                  </p>
                  <p className='text-muted-foreground text-sm'>{t('user.rotationNotice')}</p>
                </div>

                <div className='space-y-2'>
                  <h4 className='text-sm font-medium text-muted-foreground'>
                    {t('employee.employment')}
                  </h4>
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    <FormTextField
                      name='birth_date'
                      label={t('employee.birthDate')}
                      required
                      placeholder={t('employee.datePlaceholder')}
                    />
                    <FormTextField
                      name='join_date'
                      label={t('employee.joinDate')}
                      required
                      placeholder={t('employee.datePlaceholder')}
                    />
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
                  </div>
                </div>
              </form.Form>
            </form.AppForm>
          </div>

          <SheetFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type='submit' form='onboard-employee-sheet' isLoading={isPending}>
              <Icons.check /> {t('employee.onboardEmployee')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function OnboardEmployeeSheetTrigger() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size='sm' onClick={() => setOpen(true)}>
        <Icons.add /> {t('employee.onboard')}
      </Button>
      <OnboardEmployeeSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
