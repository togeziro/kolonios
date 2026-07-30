import { describe, expect, it } from 'vitest';
import { customerFiltersSchema, customerIdSchema, customerMutationSchema } from './validation';

describe('customerFiltersSchema', () => {
  it('accepts empty object', () => {
    expect(customerFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('coerces page and limit from strings', () => {
    const res = customerFiltersSchema.safeParse({ page: '1', limit: '20' });
    expect(res.success).toBe(true);
    expect(res.data!.page).toBe(1);
    expect(res.data!.limit).toBe(20);
  });

  it('rejects page <= 0', () => {
    expect(customerFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects limit > 100', () => {
    expect(customerFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('accepts optional search, status, sort strings', () => {
    const res = customerFiltersSchema.safeParse({
      search: 'john',
      status: 'active',
      sort: '[{"id":"full_name","desc":true}]'
    });
    expect(res.success).toBe(true);
  });
});

describe('customerIdSchema', () => {
  it('accepts a string id', () => {
    expect(customerIdSchema.safeParse('abc123').success).toBe(true);
  });

  it('rejects non-string values', () => {
    expect(customerIdSchema.safeParse(123).success).toBe(false);
  });
});

describe('customerMutationSchema', () => {
  const validPayload = {
    id: 'cust-1',
    full_name: 'Alice Smith',
    email: 'alice@example.com',
    phone: '+1234567890'
  };

  it('accepts a valid payload with required fields', () => {
    const res = customerMutationSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
  });

  it('rejects missing full_name', () => {
    const { full_name: _, ...rest } = validPayload;
    const res = customerMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects missing email', () => {
    const { email: _, ...rest } = validPayload;
    const res = customerMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects missing phone', () => {
    const { phone: _, ...rest } = validPayload;
    const res = customerMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects empty full_name', () => {
    const res = customerMutationSchema.safeParse({ ...validPayload, full_name: '' });
    expect(res.success).toBe(false);
  });

  it('rejects empty phone', () => {
    const res = customerMutationSchema.safeParse({ ...validPayload, phone: '' });
    expect(res.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const res = customerMutationSchema.safeParse({ ...validPayload, email: 'not-an-email' });
    expect(res.success).toBe(false);
  });

  it('accepts valid email formats', () => {
    for (const email of [
      'user@domain.com',
      'user+tag@domain.co.uk',
      'test@sub.domain.com',
      'a@b.com'
    ]) {
      expect(customerMutationSchema.safeParse({ ...validPayload, email }).success).toBe(true);
    }
  });

  it('accepts optional fields', () => {
    const res = customerMutationSchema.safeParse({
      ...validPayload,
      address: '123 Main St',
      latitude: 40.7128,
      longitude: -74.006,
      id_card_number: 'ID-123',
      notes: 'Important customer',
      status: 'active'
    });
    expect(res.success).toBe(true);
  });

  it('coerces latitude and longitude to numbers', () => {
    const res = customerMutationSchema.safeParse({
      ...validPayload,
      latitude: '40.7128',
      longitude: '-74.006'
    });
    expect(res.success).toBe(true);
    expect(res.data!.latitude).toBe(40.7128);
    expect(res.data!.longitude).toBe(-74.006);
  });
});
