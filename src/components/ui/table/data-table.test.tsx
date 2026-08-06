// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table';

const columns: ColumnDef<{ id: number; name: string }>[] = [
  { accessorKey: 'name', header: 'Name', cell: ({ row }) => row.original.name }
];

function TestTable() {
  const table = useReactTable({
    data: [{ id: 1, name: 'Ada' }],
    columns,
    getCoreRowModel: getCoreRowModel()
  });
  return (
    <DataTable table={table} tableClassName='min-w-[600px]' rowClassName='custom-row'>
      <div>toolbar</div>
    </DataTable>
  );
}

describe('DataTable', () => {
  it('renders rows and passes tableClassName to the <table>', () => {
    render(<TestTable />);
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByRole('table').className).toContain('min-w-[600px]');
  });
});
