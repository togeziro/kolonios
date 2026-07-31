import { describe, expect, it } from 'vitest';
import { availableTasksSchema, taskIdSchema } from './validation';

describe('taskIdSchema', () => {
  it('requires a positive integer taskId', () => {
    expect(taskIdSchema.safeParse({ taskId: 1 }).success).toBe(true);
    expect(taskIdSchema.safeParse({ taskId: 0 }).success).toBe(false);
    expect(taskIdSchema.safeParse({ taskId: '1' }).success).toBe(false);
  });
});

describe('availableTasksSchema', () => {
  it('accepts an empty object', () => {
    expect(availableTasksSchema.safeParse({}).success).toBe(true);
  });

  it('coerces locationId and validates priority', () => {
    expect(availableTasksSchema.safeParse({ locationId: '4' }).success).toBe(true);
    expect(availableTasksSchema.safeParse({ locationId: '4' }).data).toMatchObject({
      locationId: 4
    });
    expect(availableTasksSchema.safeParse({ priority: 'high' }).success).toBe(true);
    expect(availableTasksSchema.safeParse({ priority: 'urgent' }).success).toBe(false);
  });
});
