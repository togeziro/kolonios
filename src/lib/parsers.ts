import { z } from 'zod';

import { dataTableConfig } from '@/config/data-table';

import type { ExtendedColumnFilter, ExtendedColumnSort } from '@/types/data-table';

const ARRAY_SEPARATOR = ',';

export function parseFilterValuesFromSearch(
  search: Record<string, unknown>,
  columns: { id?: string; meta?: { options?: unknown } }[]
): Record<string, string | string[] | null> {
  const values: Record<string, string | string[] | null> = {};
  for (const column of columns) {
    const key = column.id ?? '';
    const val = search[key];
    if (val !== undefined && val !== null) {
      if (column.meta?.options) {
        values[key] = typeof val === 'string' ? val.split(ARRAY_SEPARATOR) : null;
      } else {
        values[key] = typeof val === 'string' ? val : null;
      }
    } else {
      values[key] = null;
    }
  }
  return values;
}

export function buildFilterSearchParams(
  values: Record<string, string | string[] | null>
): (prev: Record<string, unknown>) => Record<string, unknown> {
  return (prev) => {
    const next: Record<string, unknown> = { ...prev, page: 1 };
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === undefined) {
        delete next[key];
      } else if (Array.isArray(value)) {
        next[key] = value.join(ARRAY_SEPARATOR);
      } else {
        next[key] = value;
      }
    }
    return next;
  };
}

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean()
});

export function parseSortingState<TData>(
  value: string | undefined,
  columnIds?: string[] | Set<string>
): ExtendedColumnSort<TData>[] {
  if (!value) return [];
  const validKeys = columnIds ? (columnIds instanceof Set ? columnIds : new Set(columnIds)) : null;

  try {
    const parsed = JSON.parse(value);
    const result = z.array(sortingItemSchema).safeParse(parsed);
    if (!result.success) return [];
    if (validKeys && result.data.some((item) => !validKeys.has(item.id))) return [];
    return result.data as ExtendedColumnSort<TData>[];
  } catch {
    return [];
  }
}

export function serializeSortingState<TData>(value: ExtendedColumnSort<TData>[]): string {
  return JSON.stringify(value);
}

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(dataTableConfig.filterVariants),
  operator: z.enum(dataTableConfig.operators),
  filterId: z.string()
});

export type FilterItemSchema = z.infer<typeof filterItemSchema>;

export function parseFiltersState<TData>(
  value: string | undefined,
  columnIds?: string[] | Set<string>
): ExtendedColumnFilter<TData>[] {
  if (!value) return [];
  const validKeys = columnIds ? (columnIds instanceof Set ? columnIds : new Set(columnIds)) : null;

  try {
    const parsed = JSON.parse(value);
    const result = z.array(filterItemSchema).safeParse(parsed);
    if (!result.success) return [];
    if (validKeys && result.data.some((item) => !validKeys.has(item.id))) return [];
    return result.data as ExtendedColumnFilter<TData>[];
  } catch {
    return [];
  }
}

export function serializeFiltersState<TData>(value: ExtendedColumnFilter<TData>[]): string {
  return JSON.stringify(value);
}
