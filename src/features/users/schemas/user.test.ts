import { describe, expect, it } from 'vitest';
import { userSchema, userCreateSchema } from './user';

describe('user form validation', () => {
  const valid = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'Developer',
    status: 'Active'
  };

  it('accepts a valid user', () => {
    expect(userSchema.safeParse(valid).success).toBe(true);
  });

  it('requires name of at least 2 chars', () => {
    expect(userSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false);
  });

  it('requires a valid email', () => {
    expect(userSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    expect(userSchema.safeParse({ ...valid, email: 'a@b.co' }).success).toBe(true);
  });

  it('accepts a role group id and derives role', () => {
    expect(userSchema.safeParse({ ...valid, role_group_id: 'rg-123' }).success).toBe(true);
    expect(userSchema.safeParse({ ...valid, role: undefined }).success).toBe(true);
  });

  it('requires a status', () => {
    expect(userSchema.safeParse({ ...valid, status: '' }).success).toBe(false);
  });

  it('leaves password management to the create schema', () => {
    expect(userSchema.safeParse({ ...valid, password: 's3cret!!pass' }).success).toBe(true);
  });
});

describe('userCreateSchema', () => {
  const valid = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'Developer',
    status: 'Active',
    password: 's3cret!!pass',
    confirmPassword: 's3cret!!pass'
  };

  it('accepts matching passwords', () => {
    expect(userCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a password of at least 8 chars', () => {
    expect(userCreateSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
    const { password: _omitted, ...noPassword } = valid;
    expect(userCreateSchema.safeParse(noPassword).success).toBe(false);
  });

  it('rejects mismatched confirmation', () => {
    expect(userCreateSchema.safeParse({ ...valid, confirmPassword: 'different!!' }).success).toBe(
      false
    );
  });
});
