import { describe, expect, it } from 'vitest';
import { userSchema } from './user';

describe('user form validation', () => {
  const valid = {
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: '555-0123',
    role: 'Developer',
    status: 'Active'
  };

  it('accepts a valid user', () => {
    expect(userSchema.safeParse(valid).success).toBe(true);
  });

  it('requires first and last name of at least 2 chars', () => {
    expect(userSchema.safeParse({ ...valid, first_name: 'A' }).success).toBe(false);
    expect(userSchema.safeParse({ ...valid, last_name: '' }).success).toBe(false);
  });

  it('requires a valid email', () => {
    expect(userSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    expect(userSchema.safeParse({ ...valid, email: 'a@b.co' }).success).toBe(true);
  });

  it('requires a phone number', () => {
    expect(userSchema.safeParse({ ...valid, phone: '' }).success).toBe(false);
  });

  it('requires a role and status', () => {
    expect(userSchema.safeParse({ ...valid, role: '' }).success).toBe(false);
    expect(userSchema.safeParse({ ...valid, status: '' }).success).toBe(false);
  });
});
