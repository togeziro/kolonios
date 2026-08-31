import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icons } from '@/components/icons';
import { roleGroupByIdQueryOptions } from '../api/queries';
import { updateRoleGroupMutation } from '../api/mutations';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { MODULES, PERMISSION_ACTIONS } from '../modules';
import type { PermissionAction } from '@/lib/auth/session';
import type { Permissions } from '../api/types';
import { toast } from 'sonner';

const moduleActions = (key: string): readonly PermissionAction[] =>
  MODULES.find((module) => module.key === key)?.actions ?? ['view'];

export default function RolePermissionsPage() {
  const { t } = useTranslation();
  const { id } = useParams({ from: '/dashboard/admin/role-groups/$id' });
  const { data, isLoading } = useQuery(roleGroupByIdQueryOptions(id));
  const group = data?.role_group;

  const [permissions, setPermissions] = useState<Permissions>({});
  // Seed permissions whenever the group data changes — starting from
  // `undefined` so a group already present on the FIRST render (SSR /
  // dehydrated query) still seeds. Seeding only on identity change after
  // mount left the matrix blank in exactly that case.
  const [prevGroup, setPrevGroup] = useState<typeof group>(undefined);
  if (group !== prevGroup) {
    setPrevGroup(group);
    if (group) setPermissions(group.permissions ?? {});
  }

  const { mutate: save, isPending } = useMutation(
    mergeMutationCallbacks(updateRoleGroupMutation, {
      onSuccess: () => toast.success(t('roleGroups.saved')),
      onError: () => toast.error(t('roleGroups.saveFailed'))
    })
  );

  const toggleModule = useCallback((mod: string, enabled: boolean) => {
    setPermissions((prev) => {
      if (enabled) {
        return {
          ...prev,
          [mod]: Object.fromEntries(moduleActions(mod).map((action) => [action, action === 'view']))
        };
      }
      const next = { ...prev };
      delete next[mod];
      return next;
    });
  }, []);

  const toggleAction = useCallback((mod: string, action: string, value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: value }
    }));
  }, []);

  const handleSave = () => {
    if (!group) return;
    save({
      id: group.id,
      values: {
        name: group.name,
        description: group.description,
        permissions,
        is_admin: group.is_admin
      }
    });
  };

  if (isLoading)
    return <div className='py-8 text-center text-muted-foreground'>{t('common.loading')}</div>;
  if (!group)
    return <div className='py-8 text-center text-muted-foreground'>{t('roleGroups.notFound')}</div>;

  const isAdmin = group.is_admin;

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='sm' asChild>
              <Link to='/dashboard/admin/role-groups'>
                <Icons.chevronLeft className='h-4 w-4' /> {t('common.back')}
              </Link>
            </Button>
          </div>
          <h2 className='mt-2 text-xl font-bold'>
            {`${t('roleGroups.role')}:`} {group.name}
          </h2>
          <p className='text-muted-foreground text-sm'>{t('roleGroups.configureAccess')}</p>
        </div>
        <Button onClick={handleSave} disabled={isPending || isAdmin}>
          <Icons.check className='mr-2 h-4 w-4' />
          {t('roleGroups.saveChanges')}
        </Button>
      </div>

      <Card className='overflow-hidden rounded-md border'>
        <table className='w-full'>
          <thead>
            <tr className='border-b bg-muted/50'>
              <th className='px-4 py-3 text-left text-sm font-medium'>{t('roleGroups.module')}</th>
              {PERMISSION_ACTIONS.map((action) => (
                <th key={action} className='px-4 py-3 text-center text-sm font-medium w-16'>
                  {t(`roleGroups.${action}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod) => {
              const modPerm = permissions[mod.key];
              const isEnabled = !!modPerm;
              return (
                <tr
                  key={mod.key}
                  className={`border-b hover:bg-muted/30 ${isAdmin ? 'opacity-60' : ''}`}
                >
                  <td className='px-4 py-3 text-sm font-medium'>{mod.label}</td>
                  {PERMISSION_ACTIONS.map((action) => (
                    <td key={action} className='px-4 py-3 text-center'>
                      <Checkbox
                        checked={action === 'view' ? isEnabled : (modPerm?.[action] ?? false)}
                        disabled={isAdmin || !moduleActions(mod.key).includes(action)}
                        onCheckedChange={(v) =>
                          action === 'view'
                            ? toggleModule(mod.key, !!v)
                            : toggleAction(mod.key, action, !!v)
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
