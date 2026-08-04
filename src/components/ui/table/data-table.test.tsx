// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';
import { DataTable } from './data-table';

function TestTable() {
  const table = useReactTable({
    data: [{ name: 'Engineering' }],
    columns: [{ accessorKey: 'name', header: 'Name' }],
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTable table={table} />;
}

describe('DataTable', () => {
  it('keeps the table viewport visible without a fixed-height parent', () => {
    const { container } = render(<TestTable />);
    const viewport = container.querySelector('.relative.flex');

    expect(viewport?.className).toContain('min-h-64');
  });
});
