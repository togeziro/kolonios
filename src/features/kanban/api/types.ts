export type Task = {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  description?: string;
  assignee?: string;
  dueDate?: string;
};

export type BoardResponse = Record<string, Task[]>;

export type AddTaskPayload = {
  title: string;
  description?: string;
};

export type MoveTaskPayload = {
  taskId: number;
  columnSlug: string;
  position: number;
};
