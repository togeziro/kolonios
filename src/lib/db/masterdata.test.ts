import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  getDesignationsAsOptions
} from './masterdata';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { resetAllTables, seedDepartment } from '@/test-utils/db';

describe('departments data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('lists departments ordered by name', async () => {
    await seedDepartment({ name: 'Engineering', code: 'ENG' });
    await seedDepartment({ name: 'Accounting', code: 'ACC' });

    const res = await getDepartments();
    expect(res.success).toBe(true);
    expect(res.departments).toHaveLength(2);
    expect(res.departments[0].name).toBe('Accounting');
    expect(res.departments[1].name).toBe('Engineering');
  });

  it('returns empty departments list', async () => {
    const res = await getDepartments();
    expect(res.success).toBe(true);
    expect(res.departments).toHaveLength(0);
  });

  it('gets a department by id', async () => {
    const dept = await seedDepartment({ name: 'Engineering', code: 'ENG' });
    const res = await getDepartmentById(dept.id);
    expect(res.success).toBe(true);
    expect(res.department).not.toBeNull();
    expect(res.department!.name).toBe('Engineering');
  });

  it('returns null for a missing department id', async () => {
    const res = await getDepartmentById(99999);
    expect(res.success).toBe(true);
    expect(res.department).toBeNull();
  });

  it('creates a department', async () => {
    const res = await createDepartment({ name: 'HR', code: 'HR', description: 'Human Resources' });
    expect(res.success).toBe(true);
    expect(res.department.name).toBe('HR');
    expect(res.department.code).toBe('HR');
    expect(res.department.description).toBe('Human Resources');

    const all = await getDepartments();
    expect(all.departments).toHaveLength(1);
  });

  it('updates a department', async () => {
    const dept = await seedDepartment({ name: 'Old Name', code: 'OLD' });
    const res = await updateDepartment(dept.id, { name: 'New Name', description: 'Updated desc' });
    expect(res.success).toBe(true);
    expect(res.department.name).toBe('New Name');
    expect(res.department.description).toBe('Updated desc');
  });

  it('deletes a department with no designations', async () => {
    const dept = await seedDepartment();
    const res = await deleteDepartment(dept.id);
    expect(res.success).toBe(true);

    const all = await getDepartments();
    expect(all.departments).toHaveLength(0);
  });

  it('prevents deleting a department with linked designations', async () => {
    const dept = await seedDepartment();
    await createDesignation({ name: 'Engineer', code: 'SWE', department_id: dept.id });
    const res = await deleteDepartment(dept.id);
    expect(res.success).toBe(false);
  });
});

describe('designations data access (integration)', () => {
  let deptId: number;

  beforeEach(async () => {
    await resetAllTables();
    const dept = await seedDepartment({ name: 'Engineering', code: 'ENG' });
    deptId = dept.id;
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('lists designations with department join', async () => {
    await createDesignation({ name: 'Senior Dev', code: 'SRDEV', department_id: deptId });
    await createDesignation({ name: 'Junior Dev', code: 'JRDEV', department_id: deptId });

    const res = await getDesignations();
    expect(res.success).toBe(true);
    expect(res.designations).toHaveLength(2);
    expect(res.designations[0].designation.name).toBe('Junior Dev');
    expect(res.designations[0].department).not.toBeNull();
    expect(res.designations[0].department!.name).toBe('Engineering');
  });

  it('filters designations by department_id', async () => {
    const otherDept = await seedDepartment({ name: 'Marketing', code: 'MKT' });
    await createDesignation({ name: 'Dev', code: 'DEV', department_id: deptId });
    await createDesignation({ name: 'Marketer', code: 'MKTG', department_id: otherDept.id });

    const res = await getDesignations({ department_id: deptId });
    expect(res.designations).toHaveLength(1);
    expect(res.designations[0].designation.name).toBe('Dev');
  });

  it('gets a designation by id with department join', async () => {
    const created = await createDesignation({ name: 'Lead', code: 'LEAD', department_id: deptId });
    const designationId = created.designation.id;
    const res = await getDesignationById(designationId);
    expect(res.success).toBe(true);
    expect(res.designation).not.toBeNull();
    expect(res.designation!.designation.name).toBe('Lead');
    expect(res.designation!.department!.name).toBe('Engineering');
  });

  it('returns null for a missing designation id', async () => {
    const res = await getDesignationById(99999);
    expect(res.success).toBe(true);
    expect(res.designation).toBeNull();
  });

  it('creates a designation', async () => {
    const res = await createDesignation({
      name: 'Architect',
      code: 'ARCH',
      department_id: deptId,
      base_salary: 15000
    });
    expect(res.success).toBe(true);
    expect(res.designation.name).toBe('Architect');
    expect(res.designation.base_salary).toBe(15000);

    const all = await getDesignations();
    expect(all.designations).toHaveLength(1);
  });

  it('updates a designation', async () => {
    const created = await createDesignation({
      name: 'Old Title',
      code: 'OLD',
      department_id: deptId
    });
    const designationId = created.designation.id;
    const res = await updateDesignation(designationId, {
      name: 'New Title',
      description: 'Updated'
    });
    expect(res.success).toBe(true);
    expect(res.designation.name).toBe('New Title');
  });

  it('deletes a designation', async () => {
    const created = await createDesignation({
      name: 'To Delete',
      code: 'DEL',
      department_id: deptId
    });
    const designationId = created.designation.id;
    const res = await deleteDesignation(designationId);
    expect(res.success).toBe(true);

    const all = await getDesignations();
    expect(all.designations).toHaveLength(0);
  });

  it('gets designations as options (label-value pairs)', async () => {
    await createDesignation({ name: 'Engineer', code: 'ENG', department_id: deptId });

    const res = await getDesignationsAsOptions();
    expect(res.success).toBe(true);
    expect(res.options).toHaveLength(1);
    expect(res.options[0]).toMatchObject({
      value: expect.any(String),
      label: expect.stringContaining('Engineer')
    });
  });
});

describe('company settings (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
  });

  afterAll(async () => {
    await resetAllTables();
  });

  it('should have holiday_api_provider column with default value', async () => {
    const result = await db.execute(sql`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'holiday_api_provider'
    `);
    expect(result.length).toBe(1);
    expect(result[0].column_default).toContain('nager_date');
  });

  it('should have holiday_api_country_code column with default value', async () => {
    const result = await db.execute(sql`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'holiday_api_country_code'
    `);
    expect(result.length).toBe(1);
    expect(result[0].column_default).toContain('ID');
  });

  it('should have holiday_api_url column (nullable)', async () => {
    const result = await db.execute(sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'holiday_api_url'
    `);
    expect(result.length).toBe(1);
    expect(result[0].is_nullable).toBe('YES');
  });

  it('should have holiday_api_key column (nullable)', async () => {
    const result = await db.execute(sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'holiday_api_key'
    `);
    expect(result.length).toBe(1);
    expect(result[0].is_nullable).toBe('YES');
  });

  it('should have holiday_api_headers column with default empty JSON', async () => {
    const result = await db.execute(sql`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'holiday_api_headers'
    `);
    expect(result.length).toBe(1);
    expect(result[0].column_default).toContain('{}');
  });

  it('should have holiday_api_response_mapping column with default empty JSON', async () => {
    const result = await db.execute(sql`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'company_settings' AND column_name = 'holiday_api_response_mapping'
    `);
    expect(result.length).toBe(1);
    expect(result[0].column_default).toContain('{}');
  });
});
