import type { DragEndEvent, DragOverlay } from '@dnd-kit/core';
import type { DndContextProps } from '@dnd-kit/core';
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
  UniqueIdentifier
} from '@dnd-kit/core';
import type { SortableContextProps } from '@dnd-kit/sortable';
import * as React from 'react';

export const ROOT_NAME = 'Kanban';
export const BOARD_NAME = 'KanbanBoard';
export const COLUMN_NAME = 'KanbanColumn';
export const COLUMN_HANDLE_NAME = 'KanbanColumnHandle';
export const ITEM_NAME = 'KanbanItem';
export const ITEM_HANDLE_NAME = 'KanbanItemHandle';
export const OVERLAY_NAME = 'KanbanOverlay';

export interface KanbanContextValue<T> {
  id: string;
  items: Record<UniqueIdentifier, T[]>;
  modifiers: DndContextProps['modifiers'];
  strategy: SortableContextProps['strategy'];
  orientation: 'horizontal' | 'vertical';
  activeId: UniqueIdentifier | null;
  setActiveId: (id: UniqueIdentifier | null) => void;
  getItemValue: (item: T) => UniqueIdentifier;
  flatCursor: boolean;
}

export const KanbanContext = React.createContext<KanbanContextValue<unknown> | null>(null);

export function useKanbanContext(consumerName: string) {
  const context = React.useContext(KanbanContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

export const KanbanBoardContext = React.createContext<boolean>(false);

export interface KanbanColumnContextValue {
  id: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  isDragging?: boolean;
  disabled?: boolean;
}

export const KanbanColumnContext = React.createContext<KanbanColumnContextValue | null>(null);

export function useKanbanColumnContext(consumerName: string) {
  const context = React.useContext(KanbanColumnContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${COLUMN_NAME}\``);
  }
  return context;
}

export interface KanbanItemContextValue {
  id: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners | undefined;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  isDragging?: boolean;
  disabled?: boolean;
}

export const KanbanItemContext = React.createContext<KanbanItemContextValue | null>(null);

export function useKanbanItemContext(consumerName: string) {
  const context = React.useContext(KanbanItemContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ITEM_NAME}\``);
  }
  return context;
}

export const KanbanOverlayContext = React.createContext(false);

export interface GetItemValue<T> {
  getItemValue: (item: T) => UniqueIdentifier;
}

export type KanbanProps<T> = Omit<DndContextProps, 'collisionDetection'> &
  (T extends object ? GetItemValue<T> : Partial<GetItemValue<T>>) & {
    value: Record<UniqueIdentifier, T[]>;
    onValueChange?: (columns: Record<UniqueIdentifier, T[]>) => void;
    onMove?: (event: DragEndEvent & { activeIndex: number; overIndex: number }) => void;
    strategy?: SortableContextProps['strategy'];
    orientation?: 'horizontal' | 'vertical';
    flatCursor?: boolean;
  };

export interface KanbanBoardProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
  asChild?: boolean;
}

export interface KanbanColumnProps extends React.ComponentProps<'div'> {
  value: UniqueIdentifier;
  children: React.ReactNode;
  asChild?: boolean;
  asHandle?: boolean;
  disabled?: boolean;
}

export interface KanbanColumnHandleProps extends React.ComponentProps<'button'> {
  asChild?: boolean;
}

export interface KanbanItemProps extends React.ComponentProps<'div'> {
  value: UniqueIdentifier;
  asHandle?: boolean;
  asChild?: boolean;
  disabled?: boolean;
}

export interface KanbanItemHandleProps extends React.ComponentProps<'button'> {
  asChild?: boolean;
}

export interface KanbanOverlayProps extends Omit<
  React.ComponentProps<typeof DragOverlay>,
  'children'
> {
  container?: Element | DocumentFragment | null;
  children?:
    | React.ReactNode
    | ((params: { value: UniqueIdentifier; variant: 'column' | 'item' }) => React.ReactNode);
}
