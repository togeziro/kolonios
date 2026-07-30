import { describe, expect, it } from 'vitest';
import {
  departmentCreateSchema,
  departmentUpdateSchema,
  departmentDeleteSchema,
  designationFilterSchema,
  designationCreateSchema,
  designationUpdateSchema,
  designationDeleteSchema
} from './validation';

describe('departmentCreateSchema', () => {
  it('accepts valid department with required fields', () => {
    expect(departmentCreateSchema.safeParse({ name: 'Engineering', code: 'ENG' }).success).toBe(
      true
    );
  });

  it('accepts optional description', () => {
    expect(
      departmentCreateSchema.safeParse({ name: 'HR', code: 'HR', description: 'HR Department' })
        .success
    ).toBe(true);
  });

  it('rejects missing name', () => {
    expect(departmentCreateSchema.safeParse({ code: 'ENG' }).success).toBe(false);
  });

  it('rejects missing code', () => {
    expect(departmentCreateSchema.safeParse({ name: 'Engineering' }).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(departmentCreateSchema.safeParse({ name: '', code: 'ENG' }).success).toBe(false);
  });

  it('rejects empty code', () => {
    expect(departmentCreateSchema.safeParse({ name: 'Engineering', code: '' }).success).toBe(false);
  });

  it('rejects code longer than 10 characters', () => {
    expect(departmentCreateSchema.safeParse({ name: 'X', code: '12345678901' }).success).toBe(
      false
    );
  });

  it('accepts code exactly 10 characters', () => {
    expect(departmentCreateSchema.safeParse({ name: 'X', code: '1234567890' }).success).toBe(true);
  });
});

describe('departmentUpdateSchema', () => {
  it('accepts valid update with id and optional fields', () => {
    expect(departmentUpdateSchema.safeParse({ id: 1, name: 'Updated' }).success).toBe(true);
  });

  it('accepts id-only for partial update', () => {
    expect(departmentUpdateSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('rejects missing id', () => {
    expect(departmentUpdateSchema.safeParse({ name: 'NoId' }).success).toBe(false);
  });

  it('rejects non-positive id', () => {
    expect(departmentUpdateSchema.safeParse({ id: 0 }).success).toBe(false);
    expect(departmentUpdateSchema.safeParse({ id: -1 }).success).toBe(false);
  });

  it('rejects id as float', () => {
    expect(departmentUpdateSchema.safeParse({ id: 1.5 }).success).toBe(false);
  });

  it('coerces string id to number', () => {
    const res = departmentUpdateSchema.safeParse({ id: '5', name: 'X' });
    expect(res.success).toBe(true);
    expect(res.data!.id).toBe(5);
  });

  it('accepts is_active as boolean', () => {
    expect(departmentUpdateSchema.safeParse({ id: 1, is_active: false }).success).toBe(true);
  });

  it('rejects empty name when provided', () => {
    expect(departmentUpdateSchema.safeParse({ id: 1, name: '' }).success).toBe(false);
  });
});

describe('departmentDeleteSchema', () => {
  it('accepts positive id', () => {
    expect(departmentDeleteSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('rejects missing id', () => {
    expect(departmentDeleteSchema.safeParse({}).success).toBe(false);
  });

  it('rejects non-positive id', () => {
    expect(departmentDeleteSchema.safeParse({ id: 0 }).success).toBe(false);
    expect(departmentDeleteSchema.safeParse({ id: -1 }).success).toBe(false);
  });

  it('coerces string id to number', () => {
    const res = departmentDeleteSchema.safeParse({ id: '3' });
    expect(res.success).toBe(true);
    expect(res.data!.id).toBe(3);
  });
});

describe('designationFilterSchema', () => {
  it('accepts empty object', () => {
    expect(designationFilterSchema.safeParse({}).success).toBe(true);
  });

  it('accepts undefined', () => {
    expect(designationFilterSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts department_id as number', () => {
    expect(designationFilterSchema.safeParse({ department_id: 1 }).success).toBe(true);
  });

  it('coerces department_id from string', () => {
    const res = designationFilterSchema.safeParse({ department_id: '3' });
    expect(res.success).toBe(true);
    expect(res.data!.department_id).toBe(3);
  });

  it('rejects non-positive department_id', () => {
    expect(designationFilterSchema.safeParse({ department_id: 0 }).success).toBe(false);
    expect(designationFilterSchema.safeParse({ department_id: -1 }).success).toBe(false);
  });
});

describe('designationCreateSchema', () => {
  const validPayload = {
    name: 'Software Engineer',
    code: 'SWE',
    department_id: 1
  };

  it('accepts valid designation with optional department_id', () => {
    expect(designationCreateSchema.safeParse(validPayload).success).toBe(true);
  });

  it('accepts without department_id', () => {
    expect(designationCreateSchema.safeParse({ name: 'Analyst', code: 'ANA' }).success).toBe(true);
  });

  it('rejects missing name', () => {
    expect(designationCreateSchema.safeParse({ code: 'SWE' }).success).toBe(false);
  });

  it('rejects missing code', () => {
    expect(designationCreateSchema.safeParse({ name: 'Engineer' }).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(designationCreateSchema.safeParse({ name: '', code: 'SWE' }).success).toBe(false);
  });

  it('rejects code longer than 10 characters', () => {
    expect(designationCreateSchema.safeParse({ name: 'X', code: '12345678901' }).success).toBe(
      false
    );
  });

  it('rejects non-positive department_id', () => {
    expect(designationCreateSchema.safeParse({ ...validPayload, department_id: 0 }).success).toBe(
      false
    );
  });

  it('rejects negative base_salary', () => {
    expect(designationCreateSchema.safeParse({ ...validPayload, base_salary: -1 }).success).toBe(
      false
    );
  });

  it('accepts positive base_salary', () => {
    expect(designationCreateSchema.safeParse({ ...validPayload, base_salary: 50000 }).success).toBe(
      true
    );
  });

  it('accepts optional description', () => {
    const res = designationCreateSchema.safeParse({
      ...validPayload,
      description: 'Develops software'
    });
    expect(res.success).toBe(true);
  });
});

describe('designationUpdateSchema', () => {
  it('accepts id with optional fields', () => {
    expect(designationUpdateSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('rejects missing id', () => {
    expect(designationUpdateSchema.safeParse({ name: 'Updated' }).success).toBe(false);
  });

  it('rejects non-positive id', () => {
    expect(designationUpdateSchema.safeParse({ id: 0 }).success).toBe(false);
  });

  it('coerces string id to number', () => {
    const res = designationUpdateSchema.safeParse({ id: '2', name: 'X' });
    expect(res.success).toBe(true);
    expect(res.data!.id).toBe(2);
  });

  it('accepts null department_id', () => {
    expect(designationUpdateSchema.safeParse({ id: 1, department_id: null }).success).toBe(true);
  });

  it('accepts is_active boolean', () => {
    expect(designationUpdateSchema.safeParse({ id: 1, is_active: true }).success).toBe(true);
  });

  it('accepts all optional fields together', () => {
    const res = designationUpdateSchema.safeParse({
      id: 1,
      name: 'Senior SWE',
      code: 'SSWE',
      department_id: 3,
      description: 'Senior role',
      base_salary: 100000,
      is_active: true
    });
    expect(res.success).toBe(true);
  });

  it('rejects negative base_salary', () => {
    expect(designationUpdateSchema.safeParse({ id: 1, base_salary: -1 }).success).toBe(false);
  });
});

describe('designationDeleteSchema', () => {
  it('accepts positive id', () => {
    expect(designationDeleteSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('rejects missing id', () => {
    expect(designationDeleteSchema.safeParse({}).success).toBe(false);
  });

  it('rejects non-positive id', () => {
    expect(designationDeleteSchema.safeParse({ id: 0 }).success).toBe(false);
    expect(designationDeleteSchema.safeParse({ id: -1 }).success).toBe(false);
  });

  it('coerces string id to number', () => {
    const res = designationDeleteSchema.safeParse({ id: '5' });
    expect(res.success).toBe(true);
    expect(res.data!.id).toBe(5);
  });
});
