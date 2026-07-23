import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { DragOverlay, defaultDropAnimationSideEffects, type DropAnimation } from '@dnd-kit/core';
import {
  KanbanOverlayContext,
  type KanbanOverlayProps,
  useKanbanContext,
  OVERLAY_NAME
} from './contexts';
import { cn } from '@/lib/utils';

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4'
      }
    }
  })
};

function KanbanOverlay(props: KanbanOverlayProps) {
  const { container: containerProp, children, ...overlayProps } = props;

  const context = useKanbanContext(OVERLAY_NAME);

  const [mounted, setMounted] = React.useState(false);

  React.useLayoutEffect(() => setMounted(true), []);

  const container = containerProp ?? (mounted ? globalThis.document?.body : null);

  if (!container) return null;

  const variant = context.activeId && context.activeId in context.items ? 'column' : 'item';

  return ReactDOM.createPortal(
    <DragOverlay
      dropAnimation={dropAnimation}
      modifiers={context.modifiers}
      className={cn(!context.flatCursor && 'cursor-grabbing')}
      {...overlayProps}
    >
      <KanbanOverlayContext.Provider value={true}>
        {context.activeId && children
          ? typeof children === 'function'
            ? children({
                value: context.activeId,
                variant
              })
            : children
          : null}
      </KanbanOverlayContext.Provider>
    </DragOverlay>,
    container
  );
}

export { KanbanOverlay };
export type { KanbanOverlayProps } from './contexts';
