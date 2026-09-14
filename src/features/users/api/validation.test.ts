import { describe, expect, it } from 'vitest';
import {
  userFiltersSchema,
  userIdSchema,
  userMutationSchema,
  userCreateSchema,
  setUserPasswordSchema
} from './validation';

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

  it('ignores password on update (managed via dedicated endpoint)', () => {
    expect(userMutationSchema.safeParse({ ...valid, password: 's3cret!!' }).success).toBe(true);
  });
});

describe('userCreateSchema', () => {
  const valid = {
    name: 'Sam',
    email: 'sam@example.com',
    role: 'employee',
    status: 'active',
    password: 's3cret!!pass'
  };

  it('accepts a valid create payload with password', () => {
    expect(userCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a blank password (server auto-generates)', () => {
    const { password: _omitted, ...noPassword } = valid;
    expect(userCreateSchema.safeParse(noPassword).success).toBe(true);
    expect(userCreateSchema.safeParse({ ...valid, password: '' }).success).toBe(true);
  });

  it('rejects a provided-but-weak password', () => {
    expect(userCreateSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });
});

describe('setUserPasswordSchema', () => {
  it('accepts a user id and a new password', () => {
    expect(
      setUserPasswordSchema.safeParse({ userId: 'usr-1', newPassword: 'n3w!!pass' }).success
    ).toBe(true);
  });

  it('rejects missing id or short password', () => {
    expect(setUserPasswordSchema.safeParse({ newPassword: 'n3w!!pass' }).success).toBe(false);
    expect(setUserPasswordSchema.safeParse({ userId: 'usr-1', newPassword: 'short' }).success).toBe(
      false
    );
  });
});
