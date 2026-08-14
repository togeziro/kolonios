import { describe, expect, it } from 'vitest';
import { parseKeyFolder, canViewKey } from './access';

describe('storage access guard', () => {
  it('parses the folder prefix from a key', () => {
    expect(parseKeyFolder('attendance/u/1.jpg')).toBe('attendance');
    expect(parseKeyFolder('customers/c/id-card.jpg')).toBe('customers');
    expect(parseKeyFolder('tickets/1/2.jpg')).toBe('tickets');
    expect(parseKeyFolder('etc/passwd')).toBeNull();
  });

  it('allows users to read their own attendance selfies only', () => {
    expect(canViewKey('attendance/user-1/1723640000.jpg', 'user-1', false)).toBe(true);
    expect(canViewKey('attendance/user-2/1723640000.jpg', 'user-1', false)).toBe(false);
  });

  it('admins bypass the ownership check', () => {
    expect(canViewKey('attendance/user-2/1723640000.jpg', 'user-1', true)).toBe(true);
  });

  it('customers and tickets keys are not ownership-scoped', () => {
    expect(canViewKey('customers/c/id-card.jpg', 'user-1', false)).toBe(true);
    expect(canViewKey('tickets/1/2.jpg', 'user-1', false)).toBe(true);
  });
});
