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
import { Icons } from '@/components/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createUserMutation, updateUserMutation } from '../api/mutations';
import type { User } from '../api/types';
import { toast } from 'sonner';
import * as z from 'zod';
import { userSchema, type UserFormValues } from '../schemas/user';
import { STATUS_OPTIONS } from './users-table/options';
import { roleGroupsQueryOptions } from '@/features/role-groups/api/queries';

export function UserFormSheet({ user, open, onOpenChange }: UserFormSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!user;

  const { data: rgData } = useQuery(roleGroupsQueryOptions());
  const roleGroupsList =
    (rgData as { role_groups?: { id: string; name: string }[] })?.role_groups ?? [];
  const roleGroupOptions = [
    { value: '', label: t('user.noRoleGroup') },
    ...roleGroupsList.map((rg) => ({ value: rg.id, label: rg.name }))
  ];

  const createMutation = useMutation({
    ...createUserMutation,
    onSuccess: () => {
      toast.success(t('user.created'));
      onOpenChange(false);
      form.reset();
    },
    onError: () => toast.error(t('user.createFailed'))
  });

  const updateMutation = useMutation({
    ...updateUserMutation,
    onSuccess: () => {
      toast.success(t('user.updated'));
      onOpenChange(false);
    },
    onError: () => toast.error(t('user.updateFailed'))
  });

  const form = useAppForm({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role_group_id: user?.role_group_id ?? '',
      role: user?.role ?? '',
      status: user?.status ?? 'Active'
    } as UserFormValues,
    validators: {
      onSubmit: userSchema
    },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: user.id, values: value });
      } else {
        await createMutation.mutateAsync(value);
      }
    }
  });

  const { FormTextField, FormSelectField } = useFormFields<UserFormValues>();

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? t('user.edit') : t('user.new')}</SheetTitle>
          <SheetDescription>
            {isEdit ? t('user.editDescription') : t('user.newDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          <form.AppForm>
            <form.Form id='user-form-sheet' className='space-y-4'>
              <FormTextField
                name='name'
                label={t('user.name')}
                required
                placeholder={t('user.namePlaceholder')}
                validators={{
                  onBlur: z.string().min(2, t('user.nameMin'))
                }}
              />

              <FormTextField
                name='email'
                label={t('user.email')}
                required
                type='email'
                placeholder={t('user.johnEmail')}
                validators={{
                  onBlur: z.string().email(t('user.emailRequired'))
                }}
              />

              <FormSelectField
                name='role_group_id'
                label={t('user.accessLevel')}
                required
                options={roleGroupOptions}
                placeholder={t('user.selectAccessLevel')}
              />

              <FormSelectField
                name='status'
                label={t('user.status')}
                required
                options={STATUS_OPTIONS}
                placeholder={t('user.selectStatus')}
                validators={{
                  onBlur: z.string().min(1, t('user.statusRequired'))
                }}
              />
            </form.Form>
          </form.AppForm>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type='submit' form='user-form-sheet' isLoading={isPending}>
            <Icons.check /> {isEdit ? t('user.updateUser') : t('user.createUser')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

interface UserFormSheetProps {
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormSheetTrigger() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> {t('user.addUser')}
      </Button>
      <UserFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
