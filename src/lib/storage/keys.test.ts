import { describe, expect, it } from 'vitest';
import { attendanceSelfieKey, customerIdCardKey, ticketPhotoKey } from './keys';

describe('object key builders', () => {
  it('builds attendance selfie keys with user id and timestamp', () => {
    expect(attendanceSelfieKey('user-123', 1723640000)).toBe('attendance/user-123/1723640000.jpg');
  });

  it('builds customer id-card keys', () => {
    expect(customerIdCardKey('cust-7')).toBe('customers/cust-7/id-card.jpg');
  });

  it('builds ticket photo keys', () => {
    expect(ticketPhotoKey(42, 9)).toBe('tickets/42/9.jpg');
  });
});
