import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { formatCurrency } from '@/lib/format';
import type { Column, ColumnDef } from '@tanstack/react-table';

export interface DesignationRow {
  id: number;
  name: string;
  code: string;
  department_id: number | null;
  description: string | null;
  base_salary: number | null;
  is_active: boolean | null;
  department_name: string;
  created_at: Date;
}

export function getDesignationColumns(
  onEdit: (row: DesignationRow) => void,
  onDelete: (row: DesignationRow) => void,
  t: (key: string) => string
): ColumnDef<DesignationRow>[] {
  return [
    {
      id: 'code',
      accessorKey: 'code',
      header: ({ column }: { column: Column<DesignationRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('common.code')} />
      ),
      cell: ({ cell }) => <div className='font-mono text-xs'>{cell.getValue<string>()}</div>
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }: { column: Column<DesignationRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('common.name')} />
      ),
      cell: ({ cell }) => <div className='font-medium'>{cell.getValue<string>()}</div>
    },
    {
      id: 'department_name',
      accessorKey: 'department_name',
      header: ({ column }: { column: Column<DesignationRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('masterdata.department')} />
      )
    },
    {
      id: 'base_salary',
      accessorKey: 'base_salary',
      header: ({ column }: { column: Column<DesignationRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('masterdata.baseSalaryRp')} />
      ),
      cell: ({ cell }) => {
        const val = cell.getValue<number | null>();
        return val ? formatCurrency(val) : '-';
      }
    },
    {
      id: 'is_active',
      accessorKey: 'is_active',
      header: ({ column }: { column: Column<DesignationRow, unknown> }) => (
        <DataTableColumnHeader column={column} title={t('common.status')} />
      ),
      cell: ({ cell }) => {
        const active = cell.getValue<boolean | null>();
        return (
          <Badge variant={active ? 'default' : 'secondary'}>
            {active ? t('common.active') : t('common.inactive')}
          </Badge>
        );
      }
    },
    {
      id: 'actions',
      header: () => <div className='text-center'>{t('table.actions')}</div>,
      cell: ({ row }) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-8 w-8 p-0'>
              <span className='sr-only'>Open menu</span>
              <Icons.ellipsis className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Icons.edit className='mr-2 h-4 w-4' /> {t('common.update')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(row.original)}>
              <Icons.trash className='mr-2 h-4 w-4' /> {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];
}
