import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
} from './employees';
import { resetAllTables, seedUser, seedDepartment, seedDesignation } from '@/test-utils/db';
import { db } from '@/lib/db';
import { employees } from './schema/employees';

const MOCK_AUTH_USER_ID = 'mock-auth-user-id';

vi.mock('@/lib/auth/auth.server', () => ({
  auth: {
    api: {
      createUser: vi.fn().mockResolvedValue({ id: MOCK_AUTH_USER_ID }),
      updateUser: vi.fn().mockResolvedValue(undefined)
    }
  }
}));

const TEST_EMP_USER_ID = 'test-emp-user-001';

let deptId: number;
let desigId: number;

async function seedEmployee(id: string, overrides: Partial<typeof employees.$inferInsert> = {}) {
  await db.insert(employees).values({
    id,
    employee_code: `EMP-${String(Number(id.slice(-3)) || 1).padStart(4, '0')}`,
    full_name: 'Test Employee',
    email: `${id}@test.com`,
    birth_date: '1990-01-01',
    department_id: deptId,
    designation_id: desigId,
    join_date: '2024-01-01',
    ...overrides
  });
}

describe('employees data access (integration)', () => {
  beforeEach(async () => {
    await resetAllTables();
    const dept = await seedDepartment();
    deptId = dept.id;
    const desig = await seedDesignation(deptId);
    desigId = desig.id;
  });

  afterAll(async () => {
    await resetAllTables();
  });

  describe('listEmployees', () => {
    it('returns empty employees list with pagination metadata', async () => {
      const res = await listEmployees({ page: 1, limit: 10 });
      expect(res.success).toBe(true);
      expect(res.total_employees).toBe(0);
      expect(res.employees).toHaveLength(0);
    });

    it('lists seeded employees with department and designation names', async () => {
      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID, {
        full_name: 'Alice',
        email: 'alice@test.com',
        phone: '1111111111'
      });

      const res = await listEmployees({});
      expect(res.success).toBe(true);
      expect(res.total_employees).toBe(1);
      expect(res.employees[0].full_name).toBe('Alice');
      expect(res.employees[0].department_name).toBe('Engineering');
      expect(res.employees[0].designation_name).toBe('Developer');
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        const id = `emp-${i}`;
        await seedUser(id);
        await seedEmployee(id, {
          full_name: `Employee ${i}`,
          email: `test${i}@t.com`,
          employee_code: `EMP-${String(i + 1).padStart(4, '0')}`,
          phone: `${i}`.repeat(10)
        });
      }

      const page1 = await listEmployees({ page: 1, limit: 2 });
      const page2 = await listEmployees({ page: 2, limit: 2 });
      expect(page1.employees).toHaveLength(2);
      expect(page2.employees).toHaveLength(2);
      expect(page1.employees[0].id).not.toBe(page2.employees[0].id);
    });

    it('serializes created_at to ISO strings', async () => {
      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);

      const res = await listEmployees({});
      expect(res.employees[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('filters by status', async () => {
      await seedUser('emp-1');
      await seedUser('emp-2');
      await seedEmployee('emp-1', {
        full_name: 'Active',
        email: 'a@t.com',
        status: 'active',
        employee_code: 'EMP-0001',
        phone: '1111111111'
      });
      await seedEmployee('emp-2', {
        full_name: 'Inactive',
        email: 'b@t.com',
        status: 'inactive',
        employee_code: 'EMP-0002',
        phone: '2222222222'
      });

      const active = await listEmployees({ status: 'active' });
      expect(active.total_employees).toBe(1);

      const all = await listEmployees({ status: 'all' });
      expect(all.total_employees).toBe(2);
    });

    it('searches across name, email, phone and employee_code', async () => {
      await seedUser('emp-1');
      await seedUser('emp-2');
      await seedUser('emp-3');
      await seedEmployee('emp-1', {
        full_name: 'Alice',
        email: 'alice@t.com',
        phone: '1111111111',
        employee_code: 'EMP-0001'
      });
      await seedEmployee('emp-2', {
        full_name: 'Bob',
        email: 'bob@example.com',
        phone: '2222222222',
        employee_code: 'EMP-0002'
      });
      await seedEmployee('emp-3', {
        full_name: 'Carol',
        email: 'carol@t.com',
        phone: '3333333333',
        employee_code: 'EMP-0003'
      });

      const byName = await listEmployees({ search: 'Alice' });
      expect(byName.total_employees).toBe(1);

      const byEmail = await listEmployees({ search: 'example' });
      expect(byEmail.total_employees).toBe(1);

      const byCode = await listEmployees({ search: '0001' });
      expect(byCode.total_employees).toBe(1);
    });

    it('sorts by full_name ascending', async () => {
      await seedUser('emp-1');
      await seedUser('emp-2');
      await seedEmployee('emp-1', {
        full_name: 'Beta',
        email: 'b@t.com',
        employee_code: 'EMP-0001',
        phone: '1111111111'
      });
      await seedEmployee('emp-2', {
        full_name: 'Alpha',
        email: 'a@t.com',
        employee_code: 'EMP-0002',
        phone: '2222222222'
      });

      const res = await listEmployees({ sort: JSON.stringify([{ id: 'full_name', desc: false }]) });
      expect(res.employees.map((e) => e.full_name)).toEqual(['Alpha', 'Beta']);
    });
  });

  describe('getEmployeeById', () => {
    it('gets an employee by id with joined department/designation', async () => {
      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);

      const res = await getEmployeeById(TEST_EMP_USER_ID);
      expect(res.success).toBe(true);
      expect(res.employee.full_name).toBe('Test Employee');
      expect(res.employee.department_name).toBe('Engineering');
      expect(res.employee.designation_name).toBe('Developer');
    });

    it('reports failure for a missing employee id', async () => {
      const res = await getEmployeeById('nonexistent');
      expect(res.success).toBe(false);
    });
  });

  describe('deleteEmployee', () => {
    it('deletes an employee', async () => {
      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);

      const res = await deleteEmployee(TEST_EMP_USER_ID);
      expect(res.success).toBe(true);

      const all = await listEmployees({});
      expect(all.total_employees).toBe(0);
    });

    it('fails to delete a missing employee', async () => {
      const res = await deleteEmployee('nonexistent');
      expect(res.success).toBe(false);
    });
  });

  describe('createEmployee', () => {
    it('creates an employee via auth API and generates employee code', async () => {
      await seedUser(MOCK_AUTH_USER_ID);

      const res = await createEmployee({
        full_name: 'New Employee',
        nickname: 'Newbie',
        email: 'newemp@test.com',
        birth_date: '1995-05-15',
        department_id: deptId,
        designation_id: desigId,
        join_date: '2026-07-01',
        base_salary: 5000,
        created_by: TEST_EMP_USER_ID
      });

      expect(res.success).toBe(true);
      expect(res.employee).toBeDefined();
      expect(res.employee.full_name).toBe('New Employee');
      expect(res.employee.employee_code).toMatch(/^EMP-\d{4}$/);
    });
  });

  describe('updateEmployee', () => {
    it('updates an employee name and email', async () => {
      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID, { full_name: 'Original', email: 'orig@test.com' });

      const res = await updateEmployee(TEST_EMP_USER_ID, {
        full_name: 'Updated Name',
        email: 'updated@test.com',
        birth_date: '1990-01-01',
        department_id: deptId,
        designation_id: desigId,
        join_date: '2024-01-01'
      });

      expect(res.success).toBe(true);
      expect(res.employee!.full_name).toBe('Updated Name');
    });

    it('fails to update a missing employee', async () => {
      const res = await updateEmployee('nonexistent', {
        full_name: 'X',
        email: 'x@test.com',
        birth_date: '1990-01-01',
        department_id: deptId,
        designation_id: desigId,
        join_date: '2024-01-01'
      });
      expect(res.success).toBe(false);
    });
  });
});
