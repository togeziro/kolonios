import * as SlotPrimitive from '@radix-ui/react-slot';
import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  KanbanItemContext,
  type KanbanItemContextValue,
  type KanbanItemProps,
  type KanbanItemHandleProps,
  KanbanBoardContext,
  KanbanOverlayContext,
  useKanbanItemContext,
  useKanbanContext,
  ITEM_NAME,
  ITEM_HANDLE_NAME,
  BOARD_NAME
} from './contexts';
import { useComposedRefs } from '@/lib/compose-refs';
import { cn } from '@/lib/utils';

function KanbanItem(props: KanbanItemProps) {
  const { value, style, asHandle, asChild, disabled, className, ref, ...itemProps } = props;

  const id = React.useId();
  const context = useKanbanContext(ITEM_NAME);
  const inBoard = React.useContext(KanbanBoardContext);
  const inOverlay = React.useContext(KanbanOverlayContext);

  if (!inBoard && !inOverlay) {
    throw new Error(`\`${ITEM_NAME}\` must be used within \`${BOARD_NAME}\``);
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: value, disabled });

  if (value === '') {
    throw new Error(`\`${ITEM_NAME}\` value cannot be an empty string`);
  }

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

  const itemContext = React.useMemo<KanbanItemContextValue>(
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

  const ItemPrimitive = asChild ? SlotPrimitive.Slot : 'div';

  return (
    <KanbanItemContext.Provider value={itemContext}>
      <ItemPrimitive
        id={id}
        data-disabled={disabled}
        data-dragging={isDragging ? '' : undefined}
        data-slot='kanban-item'
        {...itemProps}
        {...(asHandle && !disabled ? attributes : {})}
        {...(asHandle && !disabled ? listeners : {})}
        ref={composedRef}
        style={composedStyle}
        className={cn(
          'focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
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
    </KanbanItemContext.Provider>
  );
}

function KanbanItemHandle(props: KanbanItemHandleProps) {
  const { asChild, disabled, className, ref, ...itemHandleProps } = props;

  const context = useKanbanContext(ITEM_HANDLE_NAME);
  const itemContext = useKanbanItemContext(ITEM_HANDLE_NAME);

  const isDisabled = disabled ?? itemContext.disabled;

  const composedRef = useComposedRefs(ref, (node) => {
    if (isDisabled) return;
    itemContext.setActivatorNodeRef(node);
  });

  const HandlePrimitive = asChild ? SlotPrimitive.Slot : 'button';

  return (
    <HandlePrimitive
      type='button'
      aria-controls={itemContext.id}
      data-disabled={isDisabled}
      data-dragging={itemContext.isDragging ? '' : undefined}
      data-slot='kanban-item-handle'
      {...itemHandleProps}
      {...(isDisabled ? {} : itemContext.attributes)}
      {...(isDisabled ? {} : itemContext.listeners)}
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

export { KanbanItem, KanbanItemHandle };
export type { KanbanItemProps, KanbanItemHandleProps } from './contexts';
