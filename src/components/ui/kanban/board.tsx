import * as SlotPrimitive from '@radix-ui/react-slot';
import * as React from 'react';
import {
  horizontalListSortingStrategy,
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
  KanbanBoardContext,
  type KanbanBoardProps,
  useKanbanContext,
  BOARD_NAME
} from './contexts';
import { cn } from '@/lib/utils';

function KanbanBoard(props: KanbanBoardProps) {
  const { asChild, className, ref, ...boardProps } = props;

  const context = useKanbanContext(BOARD_NAME);

  const columns = React.useMemo(() => {
    return Object.keys(context.items);
  }, [context.items]);

  const BoardPrimitive = asChild ? SlotPrimitive.Slot : 'div';

  return (
    <KanbanBoardContext.Provider value={true}>
      <SortableContext
        items={columns}
        strategy={
          context.orientation === 'horizontal'
            ? horizontalListSortingStrategy
            : verticalListSortingStrategy
        }
      >
        <BoardPrimitive
          aria-orientation={context.orientation}
          data-orientation={context.orientation}
          data-slot='kanban-board'
          {...boardProps}
          ref={ref}
          className={cn(
            'flex size-full gap-4',
            context.orientation === 'horizontal' ? 'flex-row' : 'flex-col',
            className
          )}
        />
      </SortableContext>
    </KanbanBoardContext.Provider>
  );
}

export { KanbanBoard };
export type { KanbanBoardProps } from './contexts';
