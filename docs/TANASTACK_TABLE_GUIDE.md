# TanStack Table Guide — Kolonios

Panduan lengkap penggunaan TanStack Table di Kolonios untuk konsistensi UI/UX.

## 📚 Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [File Structure](#file-structure)
4. [Basic Implementation](#basic-implementation)
5. [Server-Side Pagination](#server-side-pagination)
6. [Client-Side Pagination](#client-side-pagination)
7. [Column Definitions](#column-definitions)
8. [Filtering & Search](#filtering--search)
9. [Styling & UI](#styling--ui)
10. [Examples](#examples)
11. [Best Practices](#best-practices)

---

## Overview

Kolonios menggunakan **TanStack Table v8** untuk semua data table components. Ini memastikan konsistensi UI dan memudahkan maintenance.

**Benefits:**
- ✅ Consistent table UI across features
- ✅ Built-in pagination, filtering, sorting
- ✅ Type-safe dengan TypeScript
- ✅ Performant (virtual scrolling ready)
- ✅ Flexible & extensible

---

## Installation

TanStack Table sudah terinstall di Kolonios:

```bash
bun list @tanstack/react-table
# @tanstack/react-table@8.21.3
```

Jika perlu install ulang:
```bash
bun add @tanstack/react-table
```

---

## Mobile Responsiveness 📱

Tables must be horizontally scrollable on mobile devices without making the page feel like "desktop mode".

**Root Cause:**
The flex layout chain (SidebarInset → InfobarProvider → PageContainer) has no `overflow-x-hidden` or `min-w-0`, so a table's `minWidth` style expands the entire page instead of just triggering horizontal scroll in the table wrapper.

**Correct Pattern (from upstream):**
```tsx
// In your feature listing component:
<div className="overflow-x-auto">
  <Table 
    className="w-full table-fixed border-collapse" 
    style={{ minWidth: table.getTotalSize() }}
  >
    {/* Table content */}
  </Table>
</div>

// In layout components (already fixed in Kolonios):
// - SidebarInset: overflow-x-hidden + min-w-0
// - InfobarProvider: overflow-x-hidden + min-w-0
// - PageContainer: overflow-x-hidden + min-w-0
```

**Why this works:**
- `table.getTotalSize()` dynamically calculates total column widths
- `minWidth` forces table to be wider than mobile screen (375px)
- `overflow-x-hidden` on ancestors creates block formatting contexts that constrain the table width
- `min-w-0` on flex children allows them to shrink below content width
- `overflow-x-auto` on the table wrapper enables horizontal scrolling ONLY for the table

**Incorrect Pattern (causes desktop-mode feeling):**
```tsx
// ❌ Don't do this
<Table className="min-w-[700px]">  // Fixed width ignores actual column sizes
// ❌ Don't forget min-w-0 on flex ancestors
```

**Example:**
See `src/features/role-groups/components/role-group-listing.tsx`

---

## File Structure

Ikuti struktur file ini untuk konsistensi:

```
src/features/my-feature/
├── components/
│   ├── my-feature-listing.tsx      # Main table component
│   ├── my-feature-columns.tsx      # Column definitions
│   └── my-feature-table.tsx        # (Optional) Table UI wrapper
├── api/
│   ├── queries.ts                  # React Query options
│   ├── mutations.ts                # Mutations
│   └── types.ts                    # TypeScript types
```

**Naming Convention:**
- `feature-listing.tsx` - Main component yang render table
- `feature-columns.tsx` - Column definitions terpisah
- `feature-table.tsx` - (Optional) Jika table UI kompleks

---

## Basic Implementation

### 1. Create Column Definitions

**File: `my-feature-columns.tsx`**

```typescript
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';

export const myFeatureColumns: ColumnDef<any>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 200,
    cell: ({ row }) => (
      <span className="font-medium text-sm">
        {row.original.name}
      </span>
    ),
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    size: 120,
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'active' ? 'default' : 'outline'}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: 'actions',
    header: '',
    size: 70,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
```

### 2. Create Main Component

**File: `my-feature-listing.tsx`**

```typescript
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { myFeatureColumns } from './my-feature-columns';

export function MyFeatureListing({ data }: { data: any[] }) {
  const table = useReactTable({
    data,
    columns: myFeatureColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
      <Table className="w-full table-fixed border-collapse">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-y hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="h-10 px-4 text-left font-medium text-foreground text-sm"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="h-12 hover:bg-muted/20">
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  style={{ width: cell.column.getSize() }}
                  className="border-r px-4 align-middle last:border-r-0"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## Server-Side Pagination

Gunakan ini untuk data besar (100+ records) seperti Attendance Report.

**Example: `admin-attendance-report.tsx`**

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';

export function AdminAttendanceReport() {
  const [filters, setFilters] = useState({ page: 1, limit: 50 });
  
  const { data, isFetching } = useQuery(
    adminAttendanceReportQueryOptions(filters)
  );
  
  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / filters.limit);
  
  const table = useReactTable({
    data: records,
    columns: adminAttendanceColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // Important!
    pageCount: totalPages,
    state: {
      pagination: {
        pageIndex: filters.page - 1,
        pageSize: filters.limit,
      },
    },
  });

  return (
    <>
      {/* Table UI */}
      
      {/* Custom Pagination */}
      <div className="flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">
          Showing {records.length} of {total} records
        </span>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {filters.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
          >
            Next
          </Button>
        </div>
        
        <select
          value={filters.limit}
          onChange={(e) => setFilters(f => ({ ...f, limit: Number(e.target.value) }))}
        >
          <option value={10}>10</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </>
  );
}
```

**Key Points:**
- `manualPagination: true` - Memberi tahu TanStack Table bahwa pagination dihandle manually
- `pageCount` - Total halaman dari server
- `state.pagination` - Sync dengan state pagination aplikasi
- Render pagination UI sendiri (tidak pakai `getPaginationRowModel`)

---

## Client-Side Pagination

Gunakan ini untuk data kecil-menengah (< 100 records) seperti Roles & Permissions.

**Example: `role-group-listing.tsx`**

```typescript
import { useState } from 'react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table';

export function RoleGroupListing() {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 12,
  });

  const table = useReactTable({
    data: groups,
    columns: roleGroupColumns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(), // Important!
  });

  return (
    <>
      {/* Table UI */}
      
      {/* TanStack Pagination */}
      <div className="flex items-center justify-between p-4">
        <Pagination>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              table.previousPage();
            }}
          />
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              table.nextPage();
            }}
          />
        </Pagination>
        
        <Select
          value={`${pagination.pageSize}`}
          onValueChange={(v) => table.setPageSize(Number(v))}
        >
          <SelectItem value="12">12</SelectItem>
          <SelectItem value="24">24</SelectItem>
          <SelectItem value="48">48</SelectItem>
        </Select>
      </div>
    </>
  );
}
```

**Key Points:**
- `getPaginationRowModel: getPaginationRowModel()` - Enable client-side pagination
- `state.pagination` & `onPaginationChange` - Controlled pagination
- Gunakan `table.previousPage()`, `table.nextPage()`, dll.

---

## Column Definitions

### Basic Column

```typescript
{
  id: 'name',
  accessorKey: 'name', // Field dari data object
  header: 'Name',
  size: 200, // Optional: column width
  cell: ({ row }) => <span>{row.original.name}</span>,
}
```

### Accessor Function (Computed)

```typescript
{
  id: 'fullName',
  accessorFn: (row) => `${row.firstName} ${row.lastName}`,
  header: 'Full Name',
}
```

### Hidden Column (for filtering)

```typescript
{
  id: 'search',
  accessorFn: (row) => [row.name, row.description].join(' '),
  filterFn: 'includesString', // Enable search
  enableHiding: true,
}
```

### Filter Column

```typescript
{
  id: 'status',
  accessorKey: 'status',
  header: 'Status',
  filterFn: (row, columnId, filterValue) => {
    if (filterValue === 'All') return true;
    return row.getValue(columnId) === filterValue;
  },
}
```

---

## Filtering & Search

### Search Input

```typescript
const [search, setSearch] = useState('');

// Column definition
{
  id: 'search',
  accessorFn: (row) => [row.name, row.description].join(' '),
  filterFn: 'includesString',
  enableHiding: true,
}

// In component
<Input
  placeholder="Search..."
  value={search}
  onChange={(e) => {
    table.getColumn('search')?.setFilterValue(e.target.value || undefined);
  }}
/>
```

### Dropdown Filter

```typescript
const [typeFilter, setTypeFilter] = useState('All');

// Column definition
{
  id: 'type',
  accessorKey: 'type',
  filterFn: (row, _columnId, filterValue) => {
    if (filterValue === 'All') return true;
    return row.getValue('type') === filterValue;
  },
}

// In component
<Select
  value={typeFilter}
  onValueChange={(v) => {
    table.getColumn('type')?.setFilterValue(v === 'All' ? undefined : v);
  }}
>
  <SelectItem value="All">All</SelectItem>
  <SelectItem value="System">System</SelectItem>
  <SelectItem value="Custom">Custom</SelectItem>
</Select>
```

---

## Styling & UI

### Table Container

```typescript
<div className="overflow-hidden rounded-xl border border-border/70 bg-background">
  <Table className="w-full table-fixed border-collapse" style={{ minWidth: table.getTotalSize() }}>
    {/* Table content */}
  </Table>
</div>
```

### Table Header

```typescript
<TableHeader>
  {table.getHeaderGroups().map((headerGroup) => (
    <TableRow key={headerGroup.id} className="border-y hover:bg-transparent [&>:not(:last-child)]:border-r">
      {headerGroup.headers.map((header) => (
        <TableHead
          key={header.id}
          style={{ width: header.getSize() }}
          className="h-10 px-4 text-center font-medium text-foreground text-sm first:text-left"
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
        </TableHead>
      ))}
    </TableRow>
  ))}
</TableHeader>
```

### Table Body

```typescript
<TableBody>
  {table.getRowModel().rows.map((row) => (
    <TableRow key={row.id} className="h-12 hover:bg-muted/20">
      {row.getVisibleCells().map((cell, index) => (
        <TableCell
          key={cell.id}
          style={{ width: cell.column.getSize() }}
          className={`
            border-r px-4 align-middle
            ${index === row.getVisibleCells().length - 1 ? 'border-r-0' : ''}
            ${index === 0 ? 'text-left' : 'text-center'}
          `}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  ))}
</TableBody>
```

### Pagination UI

```typescript
<div className="flex items-center border-border/70 border-t p-4">
  <div className="text-muted-foreground text-sm">
    Showing {start} to {end} of {total} records
  </div>
  
  <Pagination className="mx-auto">
    <PaginationContent>
      <PaginationItem>
        <PaginationPrevious
          href="#"
          className={!table.getCanPreviousPage() ? 'pointer-events-none opacity-50' : ''}
          onClick={(e) => { e.preventDefault(); table.previousPage(); }}
        />
      </PaginationItem>
      <PaginationItem>
        <PaginationLink isActive>{pageIndex + 1}</PaginationLink>
      </PaginationItem>
      <PaginationItem>
        <PaginationNext
          href="#"
          className={!table.getCanNextPage() ? 'pointer-events-none opacity-50' : ''}
          onClick={(e) => { e.preventDefault(); table.nextPage(); }}
        />
      </PaginationItem>
    </PaginationContent>
  </Pagination>
  
  <div className="flex items-center gap-2">
    <span className="text-muted-foreground text-sm">Rows per page</span>
    <Select value={`${pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}>
      <SelectItem value="12">12</SelectItem>
      <SelectItem value="24">24</SelectItem>
      <SelectItem value="48">48</SelectItem>
    </Select>
  </div>
</div>
```

---

## Examples

### 1. Roles & Permissions (Full Example)

**Files:**
- `src/features/role-groups/components/role-group-listing.tsx`
- `src/features/role-groups/components/role-group-columns.tsx`

**Features:**
- ✅ Tabs (Roles, Permission sets, Access reviews)
- ✅ Filters (Search, Type dropdown)
- ✅ Pagination
- ✅ Alert notifications
- ✅ Dropdown actions

### 2. Admin Attendance Report (Server-Side)

**Files:**
- `src/features/attendance/components/admin-attendance-report.tsx`
- `src/features/attendance/components/admin-attendance-columns.tsx`

**Features:**
- ✅ Server-side pagination
- ✅ Advanced filters (date range, department, employee, etc.)
- ✅ Export buttons
- ✅ TanStack Table UI

### 3. Audit Log (Simple)

**Files:**
- `src/features/audit/components/audit-log-page.tsx`
- `src/features/audit/components/audit-log-columns.tsx`

**Features:**
- ✅ Client-side table
- ✅ Search & filter
- ✅ Clean, minimal UI

---

## Best Practices

### 1. Column Definitions

✅ **DO:**
- Pisahkan column definitions ke file terpisah
- Gunakan `flexRender` untuk render header & cell
- Set `size` untuk kontrol column width
- Gunakan `enableHiding: true` untuk hidden columns (filtering)

❌ **DON'T:**
- Jangan hardcode widths di component
- Jangan buat column definitions inline (sulit maintenance)

### 2. Data Types

✅ **DO:**
- Gunakan type yang jelas untuk data
- Jika type complex, buat interface/type alias

❌ **DON'T:**
- Jangan gunakan `any` kecuali terpaksa (sementara)
- Jangan abaikan type safety

### 3. Pagination

✅ **DO:**
- Gunakan server-side pagination untuk data besar (> 100 records)
- Gunakan client-side pagination untuk data kecil
- Sync pagination state dengan URL (optional, untuk shareable links)

❌ **DON'T:**
- Jangan fetch semua data sekaligus untuk data besar
- Jangan mix server-side & client-side pagination

### 4. Performance

✅ **DO:**
- Gunakan `React.memo` untuk column cells jika perlu
- Gunakan `useMemo` untuk expensive computations
- Batasi `pageSize` (jangan terlalu besar)

❌ **DON'T:**
- Jangan render terlalu banyak rows sekaligus (> 100)
- Jangan lakukan heavy computation di render

### 5. Styling

✅ **DO:**
- Ikuti pola styling yang sudah ada (Tailwind classes)
- Gunakan Shadcn UI components
- Konsisten dengan spacing & colors

❌ **DON'T:**
- Jangan buat custom styles yang beda dari pola existing
- Jangan hardcode colors (gunakan Tailwind classes)

---

## Migration Guide

### Dari HTML Table ke TanStack Table

**Before (Plain HTML Table):**
```typescript
<table className="w-full">
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {data.map((item) => (
      <tr key={item.id}>
        <td>{item.name}</td>
        <td>{item.status}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**After (TanStack Table):**
```typescript
// 1. Create columns
const columns: ColumnDef<any>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'status', accessorKey: 'status', header: 'Status' },
];

// 2. Initialize table
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
});

// 3. Render with Shadcn Table
<Table>
  <TableHeader>
    {table.getHeaderGroups().map(...)}
  </TableHeader>
  <TableBody>
    {table.getRowModel().rows.map(...)}
  </TableBody>
</Table>
```

---

## Column Pinning (Sticky Actions) 📌

For tables with action buttons (Edit/Delete dropdown), pin the actions column to the right so it stays visible when scrolling horizontally on mobile.

### Why Pin Actions?

On mobile devices, tables often need horizontal scrolling. Without pinning, the action buttons scroll off-screen, making it hard for users to interact with rows.

### Implementation

**1. Add `columnPinning` to `useReactTable`:**

```typescript
import { useReactTable } from '@tanstack/react-table';

const table = useReactTable({
  data,
  columns,
  initialState: {
    columnPinning: { right: ['actions'] }, // Pin the 'actions' column to the right
  },
  // ... other config
});
```

**2. Ensure the actions column has `id: 'actions'`:**

```typescript
const columns: ColumnDef<RowType>[] = [
  // ... other columns
  {
    id: 'actions', // This must match the pinning config
    header: 'Actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleEdit(row.original)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDelete(row.original)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
```

**3. Use `DataTable` component (already includes `getCommonPinningStyles`):**

The `DataTable` component automatically applies `getCommonPinningStyles` to table headers and cells, which handles the sticky positioning via CSS `position: sticky`.

```typescript
import { DataTable } from '@/components/ui/table/data-table';

<DataTable table={table} />
```

**4. For custom table markup (without `DataTable`):**

If you're using custom `<Table>` markup, apply `getCommonPinningStyles` manually:

```typescript
import { getCommonPinningStyles } from '@/lib/data-table';

<TableHead
  style={getCommonPinningStyles({ column: header.column })}
>
  {flexRender(header.column.columnDef.header, header.getContext())}
</TableHead>
```

### How It Works

- `columnPinning: { right: ['actions'] }` tells TanStack Table to pin the column
- `getCommonPinningStyles` applies `position: sticky; right: 0` CSS
- The `DataTable` component's `ScrollArea` enables horizontal scrolling
- Action buttons stay visible on the right while the rest of the table scrolls

### Example

See `src/features/customers/components/customer-tables/index.tsx` for a working example.

---

## Troubleshooting

### Error: "Column not found"

**Cause:** `accessorKey` atau `id` tidak match dengan data.

**Solution:**
```typescript
// Check column id
{
  id: 'myColumn', // This is the identifier
  accessorKey: 'fieldName', // This should exist in data
}
```

### Error: "flexRender not defined"

**Cause:** Belum import `flexRender`.

**Solution:**
```typescript
import { flexRender } from '@tanstack/react-table';
```

### Table not rendering

**Cause:** `data` kosong atau `columns` tidak terdefinisi.

**Solution:**
```typescript
console.log('Data:', data);
console.log('Columns:', columns);
```

---

## Resources

- [TanStack Table Documentation](https://tanstack.com/table/v8)
- [Shadcn UI Table](https://ui.shadcn.com/docs/components/table)
- [Kolonios AGENTS.md](./AGENTS.md) - Quick reference
- [Kolonios ARCHITECTURE.md](./ARCHITECTURE.md) - Tech stack

---

**Last Updated:** August 2026  
**Maintainers:** Kolonios Team
