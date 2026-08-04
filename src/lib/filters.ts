/**
 * Shared utility for parsing search params into filter objects.
 * Use this to reduce boilerplate in route loaders.
 */

import { parseSortingState } from './parsers';
import type { SearchParams } from '@/types';

export interface FilterConfig {
  /** Available sort columns */
  sortColumns: string[];
  /** Custom filter field mappings (search param key -> filter key) */
  fieldMappings?: Record<string, string>;
}

export function parseFilters<T extends Record<string, unknown>>(
  search: SearchParams,
  config: FilterConfig
): T & { page: number; limit: number; sort?: string } {
  const page = (search.page as number) ?? 1;
  const perPage = (search.perPage as number) ?? 10;
  const sortStr = search.sort as string | undefined;
  const sort = parseSortingState(sortStr, config.sortColumns);

  const filters: Record<string, unknown> = {
    page,
    limit: perPage
  };

  // Apply field mappings
  if (config.fieldMappings) {
    for (const [searchKey, filterKey] of Object.entries(config.fieldMappings)) {
      const value = search[searchKey];
      if (value !== undefined && value !== null) {
        filters[filterKey] = value;
      }
    }
  }

  // Auto-map common fields (name, status) if not explicitly mapped
  if (search.name !== undefined && !config.fieldMappings?.name) {
    filters.search = search.name;
  }
  if (search.status !== undefined && !config.fieldMappings?.status) {
    filters.status = search.status;
  }

  if (sort.length > 0) {
    filters.sort = JSON.stringify(sort);
  }

  return filters as T & { page: number; limit: number; sort?: string };
}
