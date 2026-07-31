export type TaskStatus = 'assigned' | 'available' | 'in_progress' | 'completed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high';

export type Task = {
  id: number;
  title: string;
  description: string;
  task_type: string;
  status: TaskStatus;
  priority: TaskPriority;
  location: { id: number; name: string } | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  requiredSkills: string[];
  assignedTo: string | null;
  takenBy: string | null;
};

export type UnavailableTask = Task & { eligibilityReasons: string[] };

export type MyTasksResponse = { success: boolean; tasks: Task[] };

export type AvailableTasksResponse = {
  success: boolean;
  tasks: Task[];
  unavailable: UnavailableTask[];
};

export type TaskActionResponse = { success: boolean; message?: string; task?: Task };

export type TaskDetailResponse = { success: boolean; task?: Task; message?: string };

export type AvailableTaskFilters = {
  locationId?: number;
  priority?: TaskPriority;
};
