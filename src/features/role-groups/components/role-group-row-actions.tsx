import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { RoleGroup } from '../api/types';

interface RoleGroupRowActionsProps {
  group: RoleGroup;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (group: RoleGroup) => void;
  onDelete: (group: RoleGroup) => void;
}

export function RoleGroupRowActions({
  group,
  canEdit,
  canDelete,
  onEdit,
  onDelete
}: RoleGroupRowActionsProps) {
  const { t } = useTranslation();
  const isSystemRole = group.is_admin;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon'>
          <MoreVertical className='h-4 w-4' />
          <span className='sr-only'>{t('common.openMenu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-48' align='end'>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to='/dashboard/admin/role-groups/$id' params={{ id: group.id }}>
              {t('common.viewDetails')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isSystemRole || !canEdit} onClick={() => onEdit(group)}>
            {t('roleGroups.editRole')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={isSystemRole || !canDelete}
            variant='destructive'
            onClick={() => onDelete(group)}
          >
            {t('common.delete')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
