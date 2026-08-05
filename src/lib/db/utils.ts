import { and, asc, desc, eq, ilike, or, type SQLWrapper } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export type PaginationInput = { page?: number; limit?: number };
export type PaginationResult = { page: number; limit: number; offset: number };

export function buildPagination(input: PaginationInput): PaginationResult {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type SortInput = { sort?: string };
export type ParsedSort = { id: string; desc: boolean } | undefined;

export function parseSort(sort?: string): ParsedSort {
  if (!sort) return undefined;
  try {
    const items = JSON.parse(sort) as { id: string; desc: boolean }[];
    return items[0];
  } catch {
    return undefined;
  }
}

export type SortColumnMap = Record<string, unknown>;

export function buildOrderBy(sortInput: SortInput, columnMap: SortColumnMap) {
  const sortItem = parseSort(sortInput.sort);
  if (!sortItem) return undefined;
  const col = columnMap[sortItem.id];
  if (!col) return undefined;
  return sortItem.desc ? desc(col as never) : asc(col as never);
}

// ---------------------------------------------------------------------------
// Common query conditions
// ---------------------------------------------------------------------------

export function buildSearchCondition(fields: SQLWrapper[], search?: string) {
  if (!search?.trim()) return undefined;
  return or(
    ...fields.map((field) => ilike(field as Parameters<typeof ilike>[0], `%${search.trim()}%`))
  );
}

export function buildStatusCondition(field: SQLWrapper, status?: string) {
  if (!status?.trim() || status === 'all') return undefined;
  return eq(field, status);
}

export function buildConditions(conditions: unknown[]) {
  const filtered = conditions.filter(Boolean);
  return filtered.length > 0 ? and(...(filtered as SQLWrapper[])) : undefined;
}
