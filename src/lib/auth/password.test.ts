import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword } from './password';

describe('generateTemporaryPassword', () => {
  it('returns a password of at least 12 characters', () => {
    expect(generateTemporaryPassword().length).toBeGreaterThanOrEqual(12);
  });

  it('uses only unambiguous alphanumeric characters', () => {
    const password = generateTemporaryPassword();
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
    expect(password).not.toMatch(/[0O1lI]/);
  });

  it('contains uppercase, lowercase and digits', () => {
    const password = generateTemporaryPassword();
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
  });

  it('produces different values on consecutive calls', () => {
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });
});
