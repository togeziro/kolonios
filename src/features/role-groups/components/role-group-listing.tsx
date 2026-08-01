import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { roleGroupsQueryOptions } from '../api/queries';
import { deleteRoleGroupMutation } from '../api/mutations';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { toast } from 'sonner';
import type { RoleGroup } from '../api/types';

export default function RoleGroupListingPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(roleGroupsQueryOptions());
  const { mutate: deleteGroup } = useMutation(
    mergeMutationCallbacks(deleteRoleGroupMutation, {
      onSuccess: () => toast.success(t('roleGroups.deleted')),
      onError: () => toast.error(t('roleGroups.deleteFailed'))
    })
  );

  const groups = (data as { role_groups?: RoleGroup[] } | undefined)?.role_groups ?? [];

  if (isLoading)
    return <div className='py-8 text-center text-muted-foreground'>{t('common.loading')}</div>;

  return (
    <div className='rounded-md border'>
      <table className='w-full'>
        <thead>
          <tr className='border-b bg-muted/50'>
            <th className='px-4 py-3 text-left text-sm font-medium'>{t('roleGroups.role')}</th>
            <th className='px-4 py-3 text-left text-sm font-medium'>
              {t('roleGroups.description')}
            </th>
            <th className='px-4 py-3 text-left text-sm font-medium'>{t('roleGroups.type')}</th>
            <th className='px-4 py-3 text-right text-sm font-medium'>{t('roleGroups.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={4} className='px-4 py-8 text-center text-muted-foreground'>
                {t('roleGroups.empty')}
              </td>
            </tr>
          ) : (
            groups.map((group) => (
              <tr key={group.id} className='border-b hover:bg-muted/30'>
                <td className='px-4 py-3 text-sm font-medium'>{group.name}</td>
                <td className='px-4 py-3 text-sm text-muted-foreground'>{group.description}</td>
                <td className='px-4 py-3'>
                  {group.is_admin ? (
                    <Badge variant='default'>{t('roleGroups.fullAccess')}</Badge>
                  ) : (
                    <Badge variant='outline'>{t('roleGroups.custom')}</Badge>
                  )}
                </td>
                <td className='px-4 py-3'>
                  <div className='flex items-center justify-end gap-1'>
                    <Button size='sm' variant='ghost' asChild>
                      <Link to='/dashboard/admin/role-groups/$id' params={{ id: group.id }}>
                        {t('roleGroups.permissions')}
                      </Link>
                    </Button>
                    <Button size='sm' variant='ghost' onClick={() => deleteGroup(group.id)}>
                      <Icons.trash className='h-4 w-4 text-destructive' />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
