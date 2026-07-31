import { describe, expect, it } from 'vitest';
import { userFiltersSchema, userIdSchema, userMutationSchema } from './validation';

describe('userFiltersSchema', () => {
  it('accepts an empty object', () => {
    expect(userFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('coerces page and limit from strings', () => {
    const res = userFiltersSchema.safeParse({ page: '2', limit: '25' });
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({ page: 2, limit: 25 });
  });

  it('rejects non-positive page and limit above 100', () => {
    expect(userFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(userFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('userIdSchema', () => {
  it('accepts a string id', () => {
    expect(userIdSchema.safeParse('usr-1').success).toBe(true);
  });

  it('rejects non-string values', () => {
    expect(userIdSchema.safeParse(123).success).toBe(false);
  });
});

describe('userMutationSchema', () => {
  const valid = { name: 'Sam', email: 'sam@example.com', role: 'employee', status: 'active' };

  it('accepts a valid payload', () => {
    expect(userMutationSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a role group id in the payload', () => {
    expect(userMutationSchema.safeParse({ ...valid, role_group_id: 'rg-1' }).success).toBe(true);
    expect(userMutationSchema.safeParse({ ...valid, role: undefined }).success).toBe(true);
  });

  it('rejects missing or invalid fields', () => {
    expect(userMutationSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    expect(userMutationSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    expect(userMutationSchema.safeParse({ ...valid, status: '' }).success).toBe(false);
  });
});
