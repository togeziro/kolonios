import type { ExtendedColumnFilter, FilterOperator, FilterVariant } from '@/types/data-table';
import type { Column, RowData } from '@tanstack/react-table';
import type { AppFeatures } from '@/lib/table-features';

import { dataTableConfig } from '@/config/data-table';

export function getCommonPinningStyles<TData extends RowData>({
  column
}: {
  column: Column<AppFeatures, TData>;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isCompactActionColumn = column.id === 'actions' && column.getSize() <= 48;

  let left: number | undefined;
  let right: number | undefined;
  let boxShadow: string | undefined;

  if (isPinned) {
    const leafId = column.getLeafColumns()[0]?.id;
    const pinnedLeaves =
      isPinned === 'start' ? column.table.getStartLeafColumns() : column.table.getEndLeafColumns();
    const pinnedIds = pinnedLeaves.map((leaf) => leaf.id);

    let offset = 0;
    if (isPinned === 'start') {
      for (const leaf of pinnedLeaves) {
        if (leaf.id === leafId) break;
        offset += leaf.getSize();
      }
      left = offset;
    } else {
      for (let i = pinnedLeaves.length - 1; i >= 0; i--) {
        if (pinnedLeaves[i]?.id === leafId) break;
        offset += pinnedLeaves[i]?.getSize() ?? 0;
      }
      right = offset;
    }

    const isLastStartPinnedColumn =
      isPinned === 'start' && pinnedIds[pinnedIds.length - 1] === leafId;
    const isFirstEndPinnedColumn = isPinned === 'end' && pinnedIds[0] === leafId;
    boxShadow = isLastStartPinnedColumn
      ? '-5px 0 5px -5px var(--border) inset'
      : isFirstEndPinnedColumn
        ? '5px 0 5px -5px var(--border) inset'
        : undefined;
  }

  return {
    boxShadow,
    left: left !== undefined ? `${left}px` : undefined,
    right: right !== undefined ? `${right}px` : undefined,
    position: isPinned ? 'sticky' : 'relative',
    background: isPinned ? 'var(--background)' : undefined,
    width: isCompactActionColumn ? '1%' : column.getSize(),
    maxWidth: isCompactActionColumn ? column.getSize() : undefined,
    zIndex: isPinned ? 1 : 0
  };
}

export function getFilterOperators(filterVariant: FilterVariant) {
  const operatorMap: Record<FilterVariant, { label: string; value: FilterOperator }[]> = {
    text: dataTableConfig.textOperators,
    number: dataTableConfig.numericOperators,
    range: dataTableConfig.numericOperators,
    date: dataTableConfig.dateOperators,
    dateRange: dataTableConfig.dateOperators,
    boolean: dataTableConfig.booleanOperators,
    select: dataTableConfig.selectOperators,
    multiSelect: dataTableConfig.multiSelectOperators
  };

  return operatorMap[filterVariant] ?? dataTableConfig.textOperators;
}

export function getDefaultFilterOperator(filterVariant: FilterVariant) {
  const operators = getFilterOperators(filterVariant);

  return operators[0]?.value ?? (filterVariant === 'text' ? 'iLike' : 'eq');
}

export function getValidFilters<TData>(
  filters: ExtendedColumnFilter<TData>[]
): ExtendedColumnFilter<TData>[] {
  return filters.filter(
    (filter) =>
      filter.operator === 'isEmpty' ||
      filter.operator === 'isNotEmpty' ||
      (Array.isArray(filter.value)
        ? filter.value.length > 0
        : filter.value !== '' && filter.value !== null && filter.value !== undefined)
  );
}
