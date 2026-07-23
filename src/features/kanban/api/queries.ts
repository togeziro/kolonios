import { queryOptions } from '@tanstack/react-query';
import { getBoardFn } from './service';

export const kanbanKeys = {
  all: ['kanban'] as const,
  board: () => [...kanbanKeys.all, 'board'] as const
};

export const boardQueryOptions = () =>
  queryOptions({
    queryKey: kanbanKeys.board(),
    queryFn: () => getBoardFn()
  });
