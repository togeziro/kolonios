import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { Product } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { CellAction } from './cell-action';
import { CATEGORY_OPTIONS } from './options';

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'photo_url',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='product.image' />
    ),
    cell: ({ row }) => {
      return (
        <div className='relative aspect-square'>
          <img
            src={row.getValue('photo_url')}
            alt={row.getValue('name')}
            className='rounded-lg object-cover w-full h-full'
          />
        </div>
      );
    }
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='common.name' />
    ),
    cell: ({ cell }) => <div>{cell.getValue<Product['name']>()}</div>,
    meta: {
      label: 'Name',
      placeholder: 'Search products...',
      variant: 'text',
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'category',
    accessorKey: 'category',
    enableSorting: false,
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='product.category' />
    ),
    cell: ({ cell }) => {
      const category = cell.getValue<Product['category']>();

      return (
        <Badge variant='outline' className='capitalize'>
          {category}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'categories',
      variant: 'multiSelect',
      options: CATEGORY_OPTIONS
    }
  },
  {
    accessorKey: 'price',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='product.price' />
    )
  },
  {
    accessorKey: 'description',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='product.description' />
    )
  },

  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
