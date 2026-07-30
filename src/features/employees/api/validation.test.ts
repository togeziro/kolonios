import { describe, expect, it } from 'vitest';
import { employeeFiltersSchema, employeeIdSchema, employeeMutationSchema } from './validation';

describe('employeeFiltersSchema', () => {
  it('accepts empty object', () => {
    expect(employeeFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('coerces page and limit from strings', () => {
    const res = employeeFiltersSchema.safeParse({ page: '1', limit: '20' });
    expect(res.success).toBe(true);
    expect(res.data!.page).toBe(1);
    expect(res.data!.limit).toBe(20);
  });

  it('rejects page <= 0', () => {
    expect(employeeFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects limit > 100', () => {
    expect(employeeFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('coerces department_id from string', () => {
    const res = employeeFiltersSchema.safeParse({ department_id: '1' });
    expect(res.success).toBe(true);
    expect(res.data!.department_id).toBe(1);
  });

  it('rejects non-positive department_id', () => {
    expect(employeeFiltersSchema.safeParse({ department_id: 0 }).success).toBe(false);
    expect(employeeFiltersSchema.safeParse({ department_id: -1 }).success).toBe(false);
  });

  it('accepts optional search, status, sort', () => {
    const res = employeeFiltersSchema.safeParse({
      search: 'john',
      status: 'active',
      sort: '[{"id":"full_name","desc":false}]'
    });
    expect(res.success).toBe(true);
  });
});

describe('employeeIdSchema', () => {
  it('accepts a string id', () => {
    expect(employeeIdSchema.safeParse('emp-123').success).toBe(true);
  });

  it('rejects non-string values', () => {
    expect(employeeIdSchema.safeParse(123).success).toBe(false);
  });
});

describe('employeeMutationSchema', () => {
  const validPayload = {
    full_name: 'John Doe',
    email: 'john@example.com',
    birth_date: '1990-01-01',
    department_id: 1,
    designation_id: 2,
    join_date: '2024-01-01'
  };

  it('accepts a valid payload with required fields', () => {
    const res = employeeMutationSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
  });

  it('rejects missing full_name', () => {
    const { full_name: _, ...rest } = validPayload;
    const res = employeeMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects missing email', () => {
    const { email: _, ...rest } = validPayload;
    const res = employeeMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects missing birth_date', () => {
    const { birth_date: _, ...rest } = validPayload;
    const res = employeeMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects missing department_id', () => {
    const { department_id: _, ...rest } = validPayload;
    const res = employeeMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects missing designation_id', () => {
    const { designation_id: _, ...rest } = validPayload;
    const res = employeeMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects missing join_date', () => {
    const { join_date: _, ...rest } = validPayload;
    const res = employeeMutationSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects empty full_name', () => {
    const res = employeeMutationSchema.safeParse({ ...validPayload, full_name: '' });
    expect(res.success).toBe(false);
  });

  it('rejects empty birth_date', () => {
    const res = employeeMutationSchema.safeParse({ ...validPayload, birth_date: '' });
    expect(res.success).toBe(false);
  });

  it('rejects empty join_date', () => {
    const res = employeeMutationSchema.safeParse({ ...validPayload, join_date: '' });
    expect(res.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const res = employeeMutationSchema.safeParse({ ...validPayload, email: 'not-an-email' });
    expect(res.success).toBe(false);
  });

  it('validates department_id as positive integer', () => {
    expect(employeeMutationSchema.safeParse({ ...validPayload, department_id: 0 }).success).toBe(
      false
    );
    expect(employeeMutationSchema.safeParse({ ...validPayload, department_id: -1 }).success).toBe(
      false
    );
  });

  it('validates designation_id as positive integer', () => {
    expect(employeeMutationSchema.safeParse({ ...validPayload, designation_id: 0 }).success).toBe(
      false
    );
  });

  it('coerces is_internship from string', () => {
    const res = employeeMutationSchema.safeParse({ ...validPayload, is_internship: 'true' });
    expect(res.success).toBe(true);
    expect(res.data!.is_internship).toBe(true);
  });

  it('validates base_salary as non-negative number', () => {
    expect(employeeMutationSchema.safeParse({ ...validPayload, base_salary: 0 }).success).toBe(
      true
    );
    expect(employeeMutationSchema.safeParse({ ...validPayload, base_salary: 5000 }).success).toBe(
      true
    );
    expect(employeeMutationSchema.safeParse({ ...validPayload, base_salary: -1 }).success).toBe(
      false
    );
  });

  it('accepts leave_date as null or undefined', () => {
    expect(employeeMutationSchema.safeParse({ ...validPayload, leave_date: null }).success).toBe(
      true
    );
    expect(
      employeeMutationSchema.safeParse({ ...validPayload, leave_date: undefined }).success
    ).toBe(true);
  });

  it('accepts all optional fields', () => {
    const res = employeeMutationSchema.safeParse({
      ...validPayload,
      nickname: 'Johnny',
      phone: '+1234567890',
      birth_place: 'NYC',
      address: '123 Main St',
      id_number: 'ID-12345',
      is_internship: false,
      employment_status: 'active',
      leave_date: null,
      base_salary: 75000,
      status: 'active'
    });
    expect(res.success).toBe(true);
  });
});
