import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  listEmployees,
  getEmployeeById,
  getMyEmployee,
  createEmployee,
  onboardEmployee,
  updateEmployee,
  deleteEmployee,
  EMPLOYEE_TRACKED_CHANGE_REQUIRES_ACTOR,
  EMPLOYEE_ALREADY_LINKED,
  ONBOARD_LINK_WITH_PASSWORD
} from './employees';
import { resetAllTables, seedUser, seedDepartment, seedDesignation } from '@/test-utils/db';
import { db } from '@/lib/db';
import { employees } from './schema/employees';
import { user } from './auth-schema';
import { DomainError } from '@/lib/errors';

const MOCK_AUTH_USER_ID = 'mock-auth-user-id';

vi.mock('@/lib/auth/auth.server', async () => {
  const { db: realDb } = await import('@/lib/db');
  const { user: userTable } = await import('@/lib/db/auth-schema');
  return {
    auth: {
      api: {
        createUser: vi.fn().mockImplementation(async ({ body }) => {
          // Mirror the real Better Auth createUser shape for tests: insert the
          // `user` row so the email-lookup branch in createEmployee finds it.
          // onConflictDoNothing keeps the existing-row pre-seeds (e.g. the
          // legacy createEmployee test) from blowing up on a duplicate id.
          await realDb
            .insert(userTable)
            .values({
              id: MOCK_AUTH_USER_ID,
              email: body.email,
              name: body.name,
              role: body.role,
              emailVerified: false
            })
            .onConflictDoNothing();
          return { id: MOCK_AUTH_USER_ID };
        }),
        adminUpdateUser: vi.fn().mockResolvedValue({ id: MOCK_AUTH_USER_ID }),
        updateUser: vi.fn().mockResolvedValue(undefined),
        removeUser: vi.fn().mockResolvedValue({ success: true })
      }
    }
  };
});

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => new Headers()
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

  describe('getMyEmployee', () => {
    it('returns self-scoped work identity with joined department/designation', async () => {
      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);

      const res = await getMyEmployee(TEST_EMP_USER_ID);
      expect(res).toEqual({
        employeeCode: expect.stringMatching(/^EMP-/),
        department: 'Engineering',
        jobTitle: 'Developer'
      });
    });

    it('returns null for a user without an employee record', async () => {
      await seedUser(TEST_EMP_USER_ID);
      const res = await getMyEmployee(TEST_EMP_USER_ID);
      expect(res).toBeNull();
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

    it('links to an existing Better Auth user instead of recreating the account', async () => {
      // Seed an auth user via the same Better Auth surface the dashboard uses
      // for /dashboard/users — captures the id the createEmployee link branch
      // must resolve to.
      const { auth } = await import('@/lib/auth/auth.server');
      const seeded = await (
        auth.api as unknown as {
          createUser: (opts: { body: Record<string, unknown> }) => Promise<{ id: string }>;
        }
      ).createUser({
        body: {
          email: 'link@example.com',
          name: 'Link Test',
          password: 'Password123!',
          role: 'employee'
        }
      });
      const capturedId = seeded.id;

      const res = await createEmployee({
        full_name: 'Link Test',
        email: 'link@example.com',
        birth_date: '1990-01-01',
        department_id: deptId,
        designation_id: desigId,
        join_date: '2024-01-01',
        created_by: TEST_EMP_USER_ID
      });

      expect(res.success).toBe(true);
      expect(res.employee.id).toBe(capturedId);

      // Exactly one user row exists for that email — the link branch must NOT
      // have called createUser a second time.
      const rows = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, 'link@example.com'));
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(capturedId);
    });

    it('rejects a second createEmployee for an email whose employee row already exists', async () => {
      const { auth } = await import('@/lib/auth/auth.server');
      await (
        auth.api as unknown as {
          createUser: (opts: { body: Record<string, unknown> }) => Promise<{ id: string }>;
        }
      ).createUser({
        body: {
          email: 'linked@example.com',
          name: 'Already Linked',
          password: 'Password123!',
          role: 'employee'
        }
      });

      const first = await createEmployee({
        full_name: 'Already Linked',
        email: 'linked@example.com',
        birth_date: '1990-01-01',
        department_id: deptId,
        designation_id: desigId,
        join_date: '2024-01-01',
        created_by: TEST_EMP_USER_ID
      });
      expect(first.success).toBe(true);

      await expect(
        createEmployee({
          full_name: 'Already Linked',
          email: 'linked@example.com',
          birth_date: '1990-01-01',
          department_id: deptId,
          designation_id: desigId,
          join_date: '2024-01-01',
          created_by: TEST_EMP_USER_ID
        })
      ).rejects.toMatchObject({ code: EMPLOYEE_ALREADY_LINKED });
    });

    it('creates a fresh auth user, the employee row, and flags mustChangePassword', async () => {
      // No prior user with this email — the createUser branch must run.
      const { auth } = await import('@/lib/auth/auth.server');
      const mocks = auth.api as unknown as {
        createUser: ReturnType<typeof vi.fn>;
      };
      mocks.createUser.mockClear();

      const res = await createEmployee({
        full_name: 'Fresh Hire',
        email: 'fresh@example.com',
        birth_date: '1990-01-01',
        department_id: deptId,
        designation_id: desigId,
        join_date: '2024-01-01',
        created_by: TEST_EMP_USER_ID
      });

      expect(res.success).toBe(true);
      expect(res.employee.email).toBe('fresh@example.com');

      // The fresh path must have called createUser exactly once.
      expect(mocks.createUser).toHaveBeenCalledTimes(1);
      expect(mocks.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            email: 'fresh@example.com',
            role: 'employee'
          })
        })
      );

      // Exactly one user row exists for that email, and it is flagged for
      // forced password rotation (mirrors users.ts:206).
      const rows = await db
        .select({ id: user.id, mustChangePassword: user.mustChangePassword })
        .from(user)
        .where(eq(user.email, 'fresh@example.com'));
      expect(rows).toHaveLength(1);
      expect(rows[0].mustChangePassword).toBe(true);
    });
  });

  describe('onboardEmployee', () => {
    const onboardBase = {
      full_name: 'Onboard Hire',
      email: 'onboard@test.com',
      birth_date: '1990-01-01',
      join_date: '2024-01-01',
      created_by: TEST_EMP_USER_ID
    };

    function onboardArgs(overrides: Record<string, unknown> = {}) {
      return {
        ...onboardBase,
        department_id: deptId,
        designation_id: desigId,
        ...overrides
      };
    }

    it('provisions account + profile atomically and returns the one-time credential', async () => {
      const res = await onboardEmployee(onboardArgs());

      expect(res.success).toBe(true);
      expect(res.linked).toBe(false);
      expect(res.employee.full_name).toBe('Onboard Hire');
      expect(res.employee.employee_code).toMatch(/^EMP-\d{4}$/);
      expect(res.user.email).toBe('onboard@test.com');
      expect(res.employee.id).toBe(res.user.id);
      expect(res.generatedPassword).toMatch(/^[A-Za-z0-9]{14}$/);

      const rows = await db
        .select({ id: user.id, mustChangePassword: user.mustChangePassword })
        .from(user)
        .where(eq(user.email, 'onboard@test.com'));
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(res.user.id);
      expect(rows[0].mustChangePassword).toBe(true);
    });

    it('honours an admin-set password (no credential echoed back)', async () => {
      const { auth } = await import('@/lib/auth/auth.server');
      const mocks = auth.api as unknown as { createUser: ReturnType<typeof vi.fn> };
      mocks.createUser.mockClear();

      const res = await onboardEmployee(onboardArgs({ password: 'Password123!' }));

      expect(res.success).toBe(true);
      expect(res.linked).toBe(false);
      expect(res.generatedPassword).toBeUndefined();
      expect(mocks.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ email: 'onboard@test.com', password: 'Password123!' })
        })
      );
    });

    it('rejects a weak provided password without creating anything', async () => {
      await expect(onboardEmployee(onboardArgs({ password: 'short' }))).rejects.toMatchObject({
        code: 'WEAK_PASSWORD'
      });

      const rows = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, 'onboard@test.com'));
      expect(rows).toHaveLength(0);
    });

    it('compensates a half-provisioned onboard by removing the orphaned account', async () => {
      // The profile insert fails AFTER the auth account exists (the id is
      // already taken by another profile → PK conflict): without compensation
      // the retry would hit "user already exists" and the orphan would linger
      // as Pending. 'mock-auth-user-id' is the id the auth mock above always
      // returns from createUser.
      await seedUser('mock-auth-user-id', { email: 'taken@test.com', name: 'Taken' });
      await seedEmployee('mock-auth-user-id', { email: 'taken@test.com' });
      const { auth } = await import('@/lib/auth/auth.server');
      const mocks = auth.api as unknown as { removeUser: ReturnType<typeof vi.fn> };
      mocks.removeUser.mockClear();

      await expect(
        onboardEmployee(onboardArgs({ email: 'orphan-onboard@test.com' }))
      ).rejects.toThrow();

      // Best-effort compensation deletes the orphan with session headers.
      expect(mocks.removeUser).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { userId: 'mock-auth-user-id' }
      });
      // No half-provisioned profile survives for the failed onboard email.
      const profiles = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.email, 'orphan-onboard@test.com'));
      expect(profiles).toHaveLength(0);
    });

    it('links a pre-existing Pending user without rotating its credential', async () => {
      const { auth } = await import('@/lib/auth/auth.server');
      const seeded = await (
        auth.api as unknown as {
          createUser: (opts: { body: Record<string, unknown> }) => Promise<{ id: string }>;
        }
      ).createUser({
        body: { email: 'pending@test.com', name: 'Pending', password: 'Password123!', role: 'user' }
      });

      const res = await onboardEmployee(onboardArgs({ email: 'pending@test.com' }));

      expect(res.success).toBe(true);
      expect(res.linked).toBe(true);
      expect(res.employee.id).toBe(seeded.id);
      expect(res.generatedPassword).toBeUndefined();

      const rows = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, 'pending@test.com'));
      expect(rows).toHaveLength(1);
    });

    it('rejects a password when linking because it would be silently ignored', async () => {
      const { auth } = await import('@/lib/auth/auth.server');
      await (
        auth.api as unknown as {
          createUser: (opts: { body: Record<string, unknown> }) => Promise<{ id: string }>;
        }
      ).createUser({
        body: {
          email: 'pending2@test.com',
          name: 'Pending',
          password: 'Password123!',
          role: 'user'
        }
      });

      await expect(
        onboardEmployee(onboardArgs({ email: 'pending2@test.com', password: 'Password123!' }))
      ).rejects.toMatchObject({ code: ONBOARD_LINK_WITH_PASSWORD });
    });

    it('rejects onboarding when the profile already exists', async () => {
      const first = await onboardEmployee(onboardArgs());
      expect(first.success).toBe(true);

      await expect(onboardEmployee(onboardArgs())).rejects.toMatchObject({
        code: EMPLOYEE_ALREADY_LINKED
      });
    });

    it('assigns the access level at provision time', async () => {
      const { roleGroups } = await import('./schema/role-groups');
      const { userRoleGroups } = await import('./schema/user-role-groups');
      await db.insert(roleGroups).values({ id: 'rg-tech', name: 'Technician', permissions: {} });

      const res = await onboardEmployee(onboardArgs({ role_group_id: 'rg-tech' }));

      expect(res.success).toBe(true);
      expect(res.role_group).toEqual({ id: 'rg-tech', name: 'Technician' });
      const memberships = await db
        .select()
        .from(userRoleGroups)
        .where(eq(userRoleGroups.user_id, res.user.id));
      expect(memberships).toHaveLength(1);
      expect(memberships[0].role_group_id).toBe('rg-tech');
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

    it('calls auth.api.adminUpdateUser with userId+data when name or email changes', async () => {
      const { auth } = await import('@/lib/auth/auth.server');
      const adminUpdateUser = (auth.api as unknown as { adminUpdateUser: ReturnType<typeof vi.fn> })
        .adminUpdateUser;
      adminUpdateUser.mockClear();

      await seedUser(TEST_EMP_USER_ID, { email: 'orig@test.com', name: 'Original' });
      await seedEmployee(TEST_EMP_USER_ID, { full_name: 'Original', email: 'orig@test.com' });

      await updateEmployee(TEST_EMP_USER_ID, {
        full_name: 'Renamed',
        email: 'renamed@test.com',
        birth_date: '1990-01-01',
        department_id: deptId,
        designation_id: desigId,
        join_date: '2024-01-01'
      });

      expect(adminUpdateUser).toHaveBeenCalledTimes(1);
      expect(adminUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            userId: TEST_EMP_USER_ID,
            data: expect.objectContaining({
              name: 'Renamed',
              email: 'renamed@test.com'
            })
          })
        })
      );
    });

    it('skips auth.api.adminUpdateUser when name and email are unchanged', async () => {
      const { auth } = await import('@/lib/auth/auth.server');
      const adminUpdateUser = (auth.api as unknown as { adminUpdateUser: ReturnType<typeof vi.fn> })
        .adminUpdateUser;
      adminUpdateUser.mockClear();

      await seedUser(TEST_EMP_USER_ID, { email: 'same@test.com', name: 'Same' });
      await seedEmployee(TEST_EMP_USER_ID, { full_name: 'Same', email: 'same@test.com' });

      await updateEmployee(TEST_EMP_USER_ID, {
        full_name: 'Same',
        email: 'same@test.com',
        birth_date: '1990-01-01',
        department_id: deptId,
        designation_id: desigId,
        join_date: '2024-01-01'
      });

      expect(adminUpdateUser).not.toHaveBeenCalled();
    });

    it('aborts updateEmployee when auth.api.adminUpdateUser rejects (no employee drift)', async () => {
      const { auth } = await import('@/lib/auth/auth.server');
      const adminUpdateUser = (auth.api as unknown as { adminUpdateUser: ReturnType<typeof vi.fn> })
        .adminUpdateUser;
      adminUpdateUser.mockRejectedValueOnce(new Error('FORBIDDEN user:set-email'));

      await seedUser(TEST_EMP_USER_ID, { email: 'orig@test.com', name: 'Original' });
      await seedEmployee(TEST_EMP_USER_ID, { full_name: 'Original', email: 'orig@test.com' });

      // The auth failure must surface as a thrown DomainError (mapDbError
      // wraps unknown errors in a generic DomainError). The employees row
      // must stay at the original email — never drift out of sync with
      // user.email.
      await expect(
        updateEmployee(TEST_EMP_USER_ID, {
          full_name: 'Renamed',
          email: 'renamed@test.com',
          birth_date: '1990-01-01',
          department_id: deptId,
          designation_id: desigId,
          join_date: '2024-01-01'
        })
      ).rejects.toBeInstanceOf(DomainError);

      const [persisted] = await db
        .select({ email: employees.email, full_name: employees.full_name })
        .from(employees)
        .where(eq(employees.id, TEST_EMP_USER_ID))
        .limit(1);
      expect(persisted?.email).toBe('orig@test.com');
      expect(persisted?.full_name).toBe('Original');
    });
  });

  describe('updateEmployee — dual-write to career timeline (regression for ticket 04)', () => {
    it('produces exactly one matching employee_career_events row when department_id changes', async () => {
      const { findCareerEventsFor } = await import('./career-timeline');
      const { seedDepartment } = await import('@/test-utils/db');

      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);
      const otherDept = await seedDepartment({ code: 'OTHER', name: 'Other' });

      await updateEmployee(
        TEST_EMP_USER_ID,
        {
          full_name: 'Updated',
          email: 'updated@test.com',
          birth_date: '1990-01-01',
          department_id: otherDept.id,
          designation_id: desigId,
          join_date: '2024-01-01'
        },
        { actorUserId: TEST_EMP_USER_ID }
      );

      const matches = await findCareerEventsFor(TEST_EMP_USER_ID, {
        category: 'division',
        toDepartmentId: otherDept.id
      });
      expect(matches).toHaveLength(1);
    });

    it('produces exactly one matching employee_career_events row when designation_id changes', async () => {
      const { findCareerEventsFor } = await import('./career-timeline');
      const { seedDepartment, seedDesignation } = await import('@/test-utils/db');

      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);
      const otherDept = await seedDepartment({ code: 'OTHER2', name: 'Other2' });
      const otherDesig = await seedDesignation(otherDept.id, {
        code: 'OTHER2-DSG',
        name: 'Senior Engineer'
      });

      await updateEmployee(
        TEST_EMP_USER_ID,
        {
          full_name: 'Updated',
          email: 'updated@test.com',
          birth_date: '1990-01-01',
          department_id: deptId,
          designation_id: otherDesig.id,
          join_date: '2024-01-01'
        },
        { actorUserId: TEST_EMP_USER_ID }
      );

      const matches = await findCareerEventsFor(TEST_EMP_USER_ID, {
        category: 'position',
        toDesignationId: otherDesig.id
      });
      expect(matches).toHaveLength(1);
    });

    it('produces exactly one employee_career_events row per tracked-column change', async () => {
      const { findCareerEventsFor } = await import('./career-timeline');
      const { seedDepartment } = await import('@/test-utils/db');

      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);
      const otherDept = await seedDepartment({ code: 'OTHER3', name: 'Other3' });

      await updateEmployee(
        TEST_EMP_USER_ID,
        {
          full_name: 'Updated',
          email: 'updated@test.com',
          birth_date: '1990-01-01',
          department_id: otherDept.id,
          designation_id: desigId,
          employment_status: 'probation',
          join_date: '2024-01-01'
        },
        { actorUserId: TEST_EMP_USER_ID }
      );

      const divisionEvents = await findCareerEventsFor(TEST_EMP_USER_ID, {
        category: 'division',
        toDepartmentId: otherDept.id
      });
      expect(divisionEvents).toHaveLength(1);

      const statusEvents = await findCareerEventsFor(TEST_EMP_USER_ID, {
        category: 'employment_status',
        toLabel: 'probation'
      });
      expect(statusEvents).toHaveLength(1);
    });

    it('does NOT create a Career Event when none of the tracked columns change', async () => {
      const { listCareerEventsForEmployee } = await import('./career-timeline');

      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);

      await updateEmployee(
        TEST_EMP_USER_ID,
        {
          full_name: 'Just a name change',
          email: 'unchanged@test.com',
          birth_date: '1990-01-01',
          department_id: deptId,
          designation_id: desigId,
          join_date: '2024-01-01'
        },
        { actorUserId: TEST_EMP_USER_ID }
      );

      expect(await listCareerEventsForEmployee(TEST_EMP_USER_ID)).toHaveLength(0);
    });

    it('rejects a tracked-column change when no actor is supplied (no silent skip)', async () => {
      const { listCareerEventsForEmployee } = await import('./career-timeline');
      const { seedDepartment } = await import('@/test-utils/db');

      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);
      const otherDept = await seedDepartment({ code: 'NOACTOR', name: 'No Actor' });

      await expect(
        updateEmployee(TEST_EMP_USER_ID, {
          full_name: 'Test Employee',
          email: `${TEST_EMP_USER_ID}@test.com`,
          birth_date: '1990-01-01',
          department_id: otherDept.id,
          designation_id: desigId,
          join_date: '2024-01-01'
        })
      ).rejects.toMatchObject({ code: EMPLOYEE_TRACKED_CHANGE_REQUIRES_ACTOR });

      // Neither the timeline row nor the tracked column was written.
      expect(await listCareerEventsForEmployee(TEST_EMP_USER_ID)).toHaveLength(0);
      const [emp] = await db
        .select({ department_id: employees.department_id })
        .from(employees)
        .where(eq(employees.id, TEST_EMP_USER_ID))
        .limit(1);
      expect(emp?.department_id).toBe(deptId);
    });

    it('rolls back every write when a later append fails mid-edit (single transaction)', async () => {
      const { listCareerEventsForEmployee } = await import('./career-timeline');
      const { seedDepartment } = await import('@/test-utils/db');

      await seedUser(TEST_EMP_USER_ID);
      await seedEmployee(TEST_EMP_USER_ID);
      const otherDept = await seedDepartment({ code: 'ATOMIC', name: 'Atomic' });

      const readState = async () => {
        const [row] = await db
          .select({
            department_id: employees.department_id,
            designation_id: employees.designation_id,
            employment_status: employees.employment_status,
            full_name: employees.full_name
          })
          .from(employees)
          .where(eq(employees.id, TEST_EMP_USER_ID))
          .limit(1);
        return row;
      };

      const before = await readState();
      expect(await listCareerEventsForEmployee(TEST_EMP_USER_ID)).toHaveLength(0);

      // department_id changes first and its event insert + column update
      // succeed inside the shared transaction; the subsequent (invalid)
      // designation append then throws, forcing a full rollback.
      await expect(
        updateEmployee(
          TEST_EMP_USER_ID,
          {
            full_name: 'Test Employee',
            email: `${TEST_EMP_USER_ID}@test.com`,
            birth_date: '1990-01-01',
            department_id: otherDept.id,
            designation_id: 999_999,
            employment_status: 'probation',
            join_date: '2024-01-01'
          },
          { actorUserId: TEST_EMP_USER_ID }
        )
      ).rejects.toThrow();

      expect(await listCareerEventsForEmployee(TEST_EMP_USER_ID)).toHaveLength(0);
      expect(await readState()).toEqual(before);
    });
  });
});
