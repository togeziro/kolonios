import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Icons } from '@/components/icons';
import { useMutation } from '@tanstack/react-query';
import { createRoleGroupMutation, updateRoleGroupMutation } from '../api/mutations';
import type { RoleGroup } from '../api/types';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { toast } from 'sonner';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';

const roleGroupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string(),
  is_admin: z.boolean()
});

interface RoleGroupFormSheetProps {
  group?: RoleGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleGroupFormSheet({ group, open, onOpenChange }: RoleGroupFormSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!group;

  const createMutation = useMutation(
    mergeMutationCallbacks(createRoleGroupMutation, {
      onSuccess: () => {
        toast.success(t('roleGroups.created'));
        onOpenChange(false);
      },
      onError: () => toast.error(t('roleGroups.createFailed'))
    })
  );

  const updateMutation = useMutation(
    mergeMutationCallbacks(updateRoleGroupMutation, {
      onSuccess: () => {
        toast.success(t('roleGroups.updated'));
        onOpenChange(false);
      },
      onError: () => toast.error(t('roleGroups.updateFailed'))
    })
  );

  const form = useForm({
    defaultValues: {
      name: group?.name ?? '',
      description: group?.description ?? '',
      is_admin: group?.is_admin ?? false
    },
    validators: {
      onChange: roleGroupSchema
    },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: group!.id,
          values: {
            name: value.name,
            description: value.description,
            permissions: group?.permissions ?? {},
            is_admin: value.is_admin
          }
        });
      } else {
        await createMutation.mutateAsync({
          name: value.name,
          description: value.description,
          permissions: {},
          is_admin: value.is_admin
        });
      }
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? t('roleGroups.editRole') : t('roleGroups.newRole')}</SheetTitle>
          <SheetDescription>
            {isEdit ? t('roleGroups.editDescription') : t('roleGroups.newDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-auto'>
          <form
            id='role-group-form'
            className='space-y-4'
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.Field name='name'>
              {(field) => (
                <div className='space-y-2'>
                  <Label htmlFor='name'>{t('roleGroups.roleName')}</Label>
                  <Input
                    id='name'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('roleGroups.roleNamePlaceholder')}
                  />
                  {field.state.meta.errors?.length ? (
                    <p className='text-xs text-destructive'>{String(field.state.meta.errors[0])}</p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name='description'>
              {(field) => (
                <div className='space-y-2'>
                  <Label htmlFor='description'>{t('roleGroups.description')}</Label>
                  <Input
                    id='description'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('roleGroups.descriptionPlaceholder')}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name='is_admin'>
              {(field) => (
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id='is_admin'
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(!!checked)}
                  />
                  <div>
                    <Label htmlFor='is_admin'>{t('roleGroups.fullAdminAccess')}</Label>
                    <p className='text-xs text-muted-foreground'>
                      {t('roleGroups.adminAccessDescription')}
                    </p>
                  </div>
                </div>
              )}
            </form.Field>
          </form>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type='submit' form='role-group-form' disabled={isPending}>
            <Icons.check /> {isEdit ? t('common.update') : t('common.create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function RoleGroupFormSheetTrigger() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> {t('roleGroups.addRole')}
      </Button>
      <RoleGroupFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
