import { describe, expect, it } from 'vitest';
import { userSchema } from './user';

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

  it('requires a role and status', () => {
    expect(userSchema.safeParse({ ...valid, role: '' }).success).toBe(false);
    expect(userSchema.safeParse({ ...valid, status: '' }).success).toBe(false);
  });
});
