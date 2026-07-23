import * as SlotPrimitive from '@radix-ui/react-slot';
import * as React from 'react';
import {
  horizontalListSortingStrategy,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  type AnimateLayoutChanges,
  defaultAnimateLayoutChanges
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  KanbanColumnContext,
  type KanbanColumnContextValue,
  type KanbanColumnProps,
  type KanbanColumnHandleProps,
  KanbanBoardContext,
  KanbanOverlayContext,
  useKanbanColumnContext,
  useKanbanContext,
  BOARD_NAME,
  COLUMN_NAME,
  COLUMN_HANDLE_NAME,
  OVERLAY_NAME
} from './contexts';
import { useComposedRefs } from '@/lib/compose-refs';
import { cn } from '@/lib/utils';

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

function KanbanColumn(props: KanbanColumnProps) {
  const { value, asChild, asHandle, disabled, className, style, ref, ...columnProps } = props;

  const id = React.useId();
  const context = useKanbanContext(COLUMN_NAME);
  const inBoard = React.useContext(KanbanBoardContext);
  const inOverlay = React.useContext(KanbanOverlayContext);

  if (!inBoard && !inOverlay) {
    throw new Error(
      `\`${COLUMN_NAME}\` must be used within \`${BOARD_NAME}\` or \`${OVERLAY_NAME}\``
    );
  }

  if (value === '') {
    throw new Error(`\`${COLUMN_NAME}\` value cannot be an empty string`);
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: value,
    disabled,
    animateLayoutChanges
  });

  const composedRef = useComposedRefs(ref, (node) => {
    if (disabled) return;
    setNodeRef(node);
  });

  const composedStyle = React.useMemo<React.CSSProperties>(() => {
    return {
      transform: CSS.Transform.toString(transform),
      transition,
      ...style
    };
  }, [transform, transition, style]);

  const items = React.useMemo(() => {
    const items = context.items[value] ?? [];
    return items.map((item) => context.getItemValue(item));
  }, [context.items, value, context.getItemValue]);

  const columnContext = React.useMemo<KanbanColumnContextValue>(
    () => ({
      id,
      attributes,
      listeners,
      setActivatorNodeRef,
      isDragging,
      disabled
    }),
    [id, attributes, listeners, setActivatorNodeRef, isDragging, disabled]
  );

  const ColumnPrimitive = asChild ? SlotPrimitive.Slot : 'div';

  return (
    <KanbanColumnContext.Provider value={columnContext}>
      <SortableContext
        items={items}
        strategy={
          context.orientation === 'horizontal'
            ? horizontalListSortingStrategy
            : verticalListSortingStrategy
        }
      >
        <ColumnPrimitive
          id={id}
          data-disabled={disabled}
          data-dragging={isDragging ? '' : undefined}
          data-slot='kanban-column'
          {...columnProps}
          {...(asHandle && !disabled ? attributes : {})}
          {...(asHandle && !disabled ? listeners : {})}
          ref={composedRef}
          style={composedStyle}
          className={cn(
            'flex size-full flex-col gap-2 rounded-lg border bg-zinc-100 p-2.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:bg-zinc-900',
            {
              'touch-none select-none': asHandle,
              'cursor-default': context.flatCursor,
              'data-dragging:cursor-grabbing': !context.flatCursor,
              'cursor-grab': !isDragging && asHandle && !context.flatCursor,
              'opacity-50': isDragging,
              'pointer-events-none opacity-50': disabled
            },
            className
          )}
        />
      </SortableContext>
    </KanbanColumnContext.Provider>
  );
}

function KanbanColumnHandle(props: KanbanColumnHandleProps) {
  const { asChild, disabled, className, ref, ...columnHandleProps } = props;

  const context = useKanbanContext(COLUMN_NAME);
  const columnContext = useKanbanColumnContext(COLUMN_HANDLE_NAME);

  const isDisabled = disabled ?? columnContext.disabled;

  const composedRef = useComposedRefs(ref, (node) => {
    if (isDisabled) return;
    columnContext.setActivatorNodeRef(node);
  });

  const HandlePrimitive = asChild ? SlotPrimitive.Slot : 'button';

  return (
    <HandlePrimitive
      type='button'
      aria-controls={columnContext.id}
      data-disabled={isDisabled}
      data-dragging={columnContext.isDragging ? '' : undefined}
      data-slot='kanban-column-handle'
      {...columnHandleProps}
      {...(isDisabled ? {} : columnContext.attributes)}
      {...(isDisabled ? {} : columnContext.listeners)}
      ref={composedRef}
      className={cn(
        'select-none disabled:pointer-events-none disabled:opacity-50',
        context.flatCursor ? 'cursor-default' : 'cursor-grab data-dragging:cursor-grabbing',
        className
      )}
      disabled={isDisabled}
    />
  );
}

export { KanbanColumn, KanbanColumnHandle };
export type { KanbanColumnProps, KanbanColumnHandleProps } from './contexts';
