import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { boardQueryOptions } from '../api/queries';
import { addTaskMutation, moveTaskMutation } from '../api/mutations';
import type { Task } from '../api/types';

export type Priority = 'low' | 'medium' | 'high';

export type { Task };

type ColumnsState = Record<string, Task[]>;

function findMovedTask(
  oldColumns: ColumnsState,
  newColumns: ColumnsState
): { taskId: number; columnSlug: string; position: number } | null {
  const oldMap: Record<string, { slug: string; index: number }> = {};
  for (const [slug, tasks] of Object.entries(oldColumns)) {
    for (let i = 0; i < tasks.length; i++) {
      oldMap[tasks[i].id] = { slug, index: i };
    }
  }

  const changed: {
    id: string;
    oldSlug: string;
    newSlug: string;
    oldIndex: number;
    newIndex: number;
    delta: number;
  }[] = [];
  for (const [slug, tasks] of Object.entries(newColumns)) {
    for (let i = 0; i < tasks.length; i++) {
      const old = oldMap[tasks[i].id];
      if (old && (old.slug !== slug || old.index !== i)) {
        changed.push({
          id: tasks[i].id,
          oldSlug: old.slug,
          newSlug: slug,
          oldIndex: old.index,
          newIndex: i,
          delta: Math.abs(old.index - i)
        });
      }
    }
  }

  if (changed.length === 0) return null;

  const crossColumn = changed.find((t) => t.oldSlug !== t.newSlug);
  const sorted = changed.toSorted((a, b) => b.delta - a.delta);
  const moved = crossColumn ?? sorted[0];
  const taskId = Number(moved.id);
  if (!Number.isFinite(taskId) || taskId <= 0) return null;
  return { taskId, columnSlug: moved.newSlug, position: moved.newIndex };
}

export function useTaskStore() {
  const { data: dbColumns } = useQuery(boardQueryOptions());
  const [optimisticColumns, setOptimisticColumns] = useState<ColumnsState | null>(null);
  const isMovingRef = useRef(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbColumnsRef = useRef(dbColumns);
  dbColumnsRef.current = dbColumns;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const columns = optimisticColumns ?? dbColumns ?? {};

  const { mutate: addTaskMutate } = useMutation(addTaskMutation);

  const { mutate: moveTaskMutate } = useMutation({
    ...moveTaskMutation,
    onSuccess: () => {
      isMovingRef.current = false;
      setOptimisticColumns(null);
    },
    onError: (err) => {
      isMovingRef.current = false;
      setOptimisticColumns(null);
      console.error('Failed to move task:', err);
    }
  });

  const setColumns = useCallback(
    (newColumns: ColumnsState) => {
      setOptimisticColumns(newColumns);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;

        if (isMovingRef.current) return;
        isMovingRef.current = true;

        const board = dbColumnsRef.current ?? {};
        const moved = findMovedTask(board, newColumns);
        if (moved) {
          moveTaskMutate(moved);
        } else {
          isMovingRef.current = false;
        }
      }, 300);
    },
    [moveTaskMutate]
  );

  const addTask = useCallback(
    (title: string, description?: string) => {
      addTaskMutate({ title, description });
    },
    [addTaskMutate]
  );

  return { columns, setColumns, addTask };
}
