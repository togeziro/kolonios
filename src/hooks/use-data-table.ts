import {
  type ColumnFiltersState,
  type ColumnPinningState,
  type ColumnVisibilityState,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  useTable
} from '@tanstack/react-table';
import { useNavigate, useSearch } from '@tanstack/react-router';
import * as React from 'react';

import { appFeatures, type AppFeatures } from '@/lib/table-features';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import {
  buildFilterSearchParams,
  parseFilterValuesFromSearch,
  parseSortingState,
  serializeSortingState
} from '@/lib/parsers';
import type { ExtendedColumnSort } from '@/types/data-table';
import type { SearchParams, NavigateWithSearch } from '@/types';

const DEBOUNCE_MS = 300;

interface UseDataTableProps<TData extends RowData>
  extends
    Omit<
      TableOptions<AppFeatures, TData>,
      'state' | 'pageCount' | 'features' | 'manualFiltering' | 'manualPagination' | 'manualSorting'
    >,
    Required<Pick<TableOptions<AppFeatures, TData>, 'pageCount'>> {
  initialState?: Omit<Partial<TableState<AppFeatures>>, 'sorting'> & {
    sorting?: ExtendedColumnSort<TData>[];
  };
  history?: 'push' | 'replace';
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  enableAdvancedFilter?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
}

export function useDataTable<TData extends RowData>(props: UseDataTableProps<TData>) {
  const {
    columns,
    pageCount = -1,
    initialState,
    history = 'replace',
    debounceMs = DEBOUNCE_MS,
    enableAdvancedFilter = false,
    shallow = true,
    ...tableProps
  } = props;

  const search = useSearch({ strict: false }) as SearchParams;
  const navigate = useNavigate() as unknown as NavigateWithSearch;

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(
    initialState?.columnVisibility ?? {}
  );
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(
    initialState?.columnPinning ?? { start: [], end: [] }
  );

  // Read pagination from search params
  const page = (search.page as number) ?? 1;
  const perPage = (search.perPage as number) ?? initialState?.pagination?.pageSize ?? 10;

  const pagination: PaginationState = React.useMemo(
    () => ({
      pageIndex: page - 1,
      pageSize: perPage
    }),
    [page, perPage]
  );

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      const newPagination =
        typeof updaterOrValue === 'function' ? updaterOrValue(pagination) : updaterOrValue;
      void navigate({
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          page: newPagination.pageIndex + 1,
          perPage: newPagination.pageSize
        }),
        replace: history === 'replace'
      });
    },
    [pagination, navigate, history]
  );

  // Read sorting from search params
  const columnIds = React.useMemo(() => {
    return new Set(columns.map((column) => column.id).filter(Boolean) as string[]);
  }, [columns]);

  const sorting = React.useMemo(
    () =>
      parseSortingState<TData>(search.sort as string | undefined, columnIds) ??
      initialState?.sorting ??
      [],
    [search.sort, columnIds, initialState?.sorting]
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      const newSorting =
        typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue;
      void navigate({
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          sort:
            newSorting.length > 0
              ? serializeSortingState(newSorting as ExtendedColumnSort<TData>[])
              : undefined
        }),
        replace: history === 'replace'
      });
    },
    [sorting, navigate, history]
  );

  // Filter handling
  const filterableColumns = React.useMemo(() => {
    if (enableAdvancedFilter) return [];
    return columns.filter((column) => column.enableColumnFilter);
  }, [columns, enableAdvancedFilter]);

  // Read filter values from search params
  const filterValues = React.useMemo(
    () => (enableAdvancedFilter ? {} : parseFilterValuesFromSearch(search, filterableColumns)),
    [search, filterableColumns, enableAdvancedFilter]
  );

  const debouncedSetFilterValues = useDebouncedCallback(
    (values: Record<string, string | string[] | null>) => {
      void navigate({ search: buildFilterSearchParams(values), replace: history === 'replace' });
    },
    debounceMs
  );

  const initialColumnFilters: ColumnFiltersState = React.useMemo(() => {
    if (enableAdvancedFilter) return [];

    return Object.entries(filterValues).reduce<ColumnFiltersState>((filters, [key, value]) => {
      if (value !== null) {
        const processedValue = Array.isArray(value)
          ? value
          : typeof value === 'string' && /[^a-zA-Z0-9]/.test(value)
            ? value.split(/[^a-zA-Z0-9]+/).filter(Boolean)
            : [value];

        filters.push({
          id: key,
          value: processedValue
        });
      }
      return filters;
    }, []);
  }, [filterValues, enableAdvancedFilter]);

  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialColumnFilters);

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return;

      setColumnFilters((prev) => {
        const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue;

        const filterUpdates: Record<string, string | string[] | null> = {};
        for (const filter of next) {
          if (filterableColumns.find((column) => column.id === filter.id)) {
            filterUpdates[filter.id] = filter.value as string | string[];
          }
        }

        for (const prevFilter of prev) {
          if (!next.some((filter) => filter.id === prevFilter.id)) {
            filterUpdates[prevFilter.id] = null;
          }
        }

        debouncedSetFilterValues(filterUpdates);
        return next;
      });
    },
    [debouncedSetFilterValues, filterableColumns, enableAdvancedFilter]
  );

  const table = useTable<AppFeatures, TData>({
    ...tableProps,
    features: appFeatures,
    columns,
    initialState,
    pageCount,
    state: {
      pagination,
      sorting,
      columnVisibility,
      columnPinning,
      rowSelection,
      columnFilters
    },
    defaultColumn: {
      ...tableProps.defaultColumn,
      enableColumnFilter: false
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true
  });

  return { table, shallow, debounceMs, throttleMs: props.throttleMs };
}
