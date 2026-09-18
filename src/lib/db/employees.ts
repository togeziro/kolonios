import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './index';
import { DomainError, mapDbError } from '../errors';
import { businessDateInTimeZone } from '@/lib/dates';
import { logger } from '../logger';
import { generateTemporaryPassword, setMustChangePassword } from '../auth/password';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { employees } from './schema/employees';
import { departments, designations } from './schema/masterdata';
import { user } from './auth-schema';
import type {
  EmployeeFilters,
  EmployeesResponse,
  EmployeeByIdResponse,
  EmployeeMutationPayload,
  OnboardEmployeePayload
} from '@/lib/domain/employees';
import { buildPagination, buildOrderBy, buildSearchCondition, buildStatusCondition } from './utils';

const sortColumnMap = {
  employee_code: employees.employee_code,
  full_name: employees.full_name,
  email: employees.email,
  department_name: departments.name,
  designation_name: designations.name,
  phone: employees.phone,
  status: employees.status,
  join_date: employees.join_date,
  created_at: employees.created_at
} as const;

function serialize(row: {
  id: string;
  employee_code: string;
  full_name: string;
  nickname: string;
  email: string;
  phone: string;
  birth_place: string;
  birth_date: string;
  address: string;
  id_number: string;
  department_id: number;
  designation_id: number;
  is_internship: boolean;
  employment_status: string;
  join_date: string;
  leave_date: string | null;
  base_salary: number;
  status: string;
  created_at: Date;
  updated_at: Date;
  department_name: string | null;
  designation_name: string | null;
}) {
  return {
    id: row.id,
    employee_code: row.employee_code,
    full_name: row.full_name,
    nickname: row.nickname,
    email: row.email,
    phone: row.phone,
    birth_place: row.birth_place,
    birth_date: row.birth_date,
    address: row.address,
    id_number: row.id_number,
    department_id: row.department_id,
    designation_id: row.designation_id,
    is_internship: row.is_internship,
    employment_status: row.employment_status,
    join_date: row.join_date,
    leave_date: row.leave_date,
    base_salary: row.base_salary,
    status: row.status,
    department_name: row.department_name ?? '',
    designation_name: row.designation_name ?? '',
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
}

async function getEmployeeOr404(id: string) {
  const [row] = await db
    .select({
      id: employees.id,
      employee_code: employees.employee_code,
      full_name: employees.full_name,
      nickname: employees.nickname,
      email: employees.email,
      phone: employees.phone,
      birth_place: employees.birth_place,
      birth_date: employees.birth_date,
      address: employees.address,
      id_number: employees.id_number,
      department_id: employees.department_id,
      designation_id: employees.designation_id,
      is_internship: employees.is_internship,
      employment_status: employees.employment_status,
      join_date: employees.join_date,
      leave_date: employees.leave_date,
      base_salary: employees.base_salary,
      status: employees.status,
      created_at: employees.created_at,
      updated_at: employees.updated_at,
      department_name: departments.name,
      designation_name: designations.name
    })
    .from(employees)
    .leftJoin(departments, eq(employees.department_id, departments.id))
    .leftJoin(designations, eq(employees.designation_id, designations.id))
    .where(eq(employees.id, id))
    .limit(1);
  return row ?? null;
}

async function generateEmployeeCode(): Promise<string> {
  const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(employees);
  const next = (result.count ?? 0) + 1;
  return `EMP-${String(next).padStart(4, '0')}`;
}

const employeeWithJoins = {
  id: employees.id,
  employee_code: employees.employee_code,
  full_name: employees.full_name,
  nickname: employees.nickname,
  email: employees.email,
  phone: employees.phone,
  birth_place: employees.birth_place,
  birth_date: employees.birth_date,
  address: employees.address,
  id_number: employees.id_number,
  department_id: employees.department_id,
  designation_id: employees.designation_id,
  is_internship: employees.is_internship,
  employment_status: employees.employment_status,
  join_date: employees.join_date,
  leave_date: employees.leave_date,
  base_salary: employees.base_salary,
  status: employees.status,
  created_at: employees.created_at,
  updated_at: employees.updated_at,
  department_name: departments.name,
  designation_name: designations.name
};

export async function listEmployees(filters: EmployeeFilters): Promise<EmployeesResponse> {
  try {
    const { limit, offset } = buildPagination(filters);

    const statusCondition = buildStatusCondition(employees.status, filters.status);
    const deptCondition = filters.department_id
      ? eq(employees.department_id, filters.department_id)
      : undefined;
    const searchCondition = buildSearchCondition(
      [employees.full_name, employees.email, employees.phone, employees.employee_code],
      filters.search
    );
    const where = and(statusCondition, deptCondition, searchCondition);
    const orderBy = buildOrderBy(filters, sortColumnMap) ?? asc(employees.created_at);

    const [rows, [{ count }]] = await Promise.all([
      db
        .select(employeeWithJoins)
        .from(employees)
        .leftJoin(departments, eq(employees.department_id, departments.id))
        .leftJoin(designations, eq(employees.designation_id, designations.id))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(where)
    ]);

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Employees fetched from PostgreSQL',
      total_employees: count,
      offset,
      limit,
      employees: rows.map((r) => serialize(r))
    };
  } catch (e) {
    mapDbError(e, 'employees.listEmployees');
  }
}

export async function getEmployeeById(id: string): Promise<EmployeeByIdResponse> {
  try {
    const row = await getEmployeeOr404(id);

    if (!row) {
      return {
        success: false,
        time: new Date().toISOString(),
        message: `Employee with ID ${id} not found`
      } as EmployeeByIdResponse;
    }

    return {
      success: true,
      time: new Date().toISOString(),
      message: `Employee with ID ${id} found`,
      employee: serialize(row)
    };
  } catch (e) {
    mapDbError(e, 'employees.getEmployeeById');
  }
}

/**
 * Self-scoped employee summary for the signed-in user (id mirrors user.id).
 * Deliberately returns only work-identity fields — never salary/status — so
 * it can be exposed to any signed-in user via their own profile page.
 */
export async function getMyEmployee(
  userId: string
): Promise<{ employeeCode: string; department: string; jobTitle: string } | null> {
  try {
    const [row] = await db
      .select({
        employeeCode: employees.employee_code,
        department: departments.name,
        jobTitle: designations.name
      })
      .from(employees)
      .leftJoin(departments, eq(employees.department_id, departments.id))
      .leftJoin(designations, eq(employees.designation_id, designations.id))
      .where(eq(employees.id, userId))
      .limit(1);
    if (!row) return null;
    return {
      employeeCode: row.employeeCode,
      department: row.department ?? '',
      jobTitle: row.jobTitle ?? ''
    };
  } catch (e) {
    mapDbError(e, 'employees.getMyEmployee');
  }
}

type AuthUserRecord = { id: string; role?: string };
type AdminAuthApi = {
  createUser: (opts: { body: Record<string, unknown> }) => Promise<AuthUserRecord>;
  adminUpdateUser: (opts: {
    headers: Headers;
    body: { userId: string; data: Record<string, unknown> };
  }) => Promise<unknown>;
  removeUser: (opts: {
    headers: Headers;
    body: { userId: string };
  }) => Promise<{ success: boolean }>;
};

export async function createEmployee(data: EmployeeMutationPayload & { created_by: string }) {
  // Track the auth-user id so a failure AFTER createUser can compensate
  // (delete the orphan) instead of leaving a half-provisioned account. Only
  // set in the "fresh user" branch — the "link existing user" branch must
  // never rotate or delete a pre-existing account.
  let createdUserId: string | null = null;
  try {
    const dataEmail = data.email.toLowerCase();

    // Look up an existing Better Auth user by email first — the employee form
    // can be used to complete the profile of someone already provisioned via
    // /dashboard/users (or any other path that writes to the `user` table).
    // This avoids the `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` race that
    // otherwise surfaces as a generic toast with no audit trail.
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, dataEmail))
      .limit(1);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      // If the employee row already exists for this id, the account is
      // already fully linked — surface a domain error so the UI can show
      // a targeted message instead of a generic "something went wrong".
      const [existingEmp] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, userId))
        .limit(1);
      if (existingEmp) {
        throw new DomainError(
          `Employee with email "${dataEmail}" is already registered`,
          EMPLOYEE_ALREADY_LINKED
        );
      }
      // Account already exists — do NOT rotate the credential. The
      // mustChangePassword flag stays whatever it is on the existing row.
    } else {
      const { auth } = await import('@/lib/auth/auth.server');
      const created = await (auth.api as unknown as AdminAuthApi).createUser({
        body: {
          email: dataEmail,
          name: data.full_name,
          password: generateTemporaryPassword(),
          role: 'employee'
        }
      });
      userId = created.id as string;
      createdUserId = userId;
      await setMustChangePassword(userId);
    }

    const employee_code = await generateEmployeeCode();

    const [inserted] = await db
      .insert(employees)
      .values({
        id: userId,
        employee_code,
        full_name: data.full_name,
        nickname: data.nickname ?? '',
        // Lower-cased to match `user.email` (Better Auth forces lowercase on
        // its side). Storing the mixed-case original here would let the two
        // columns drift apart for queries that compare against lowercase.
        email: dataEmail,
        phone: data.phone ?? '',
        birth_place: data.birth_place ?? '',
        birth_date: data.birth_date,
        address: data.address ?? '',
        id_number: data.id_number ?? '',
        department_id: data.department_id,
        designation_id: data.designation_id,
        is_internship: data.is_internship ?? false,
        employment_status: data.employment_status ?? 'active',
        join_date: data.join_date,
        leave_date: data.leave_date ?? null,
        base_salary: data.base_salary ?? 0,
        status: data.status ?? 'active'
      })
      .returning();

    return {
      success: true,
      message: 'Employee created successfully',
      employee: serialize({
        ...inserted,
        department_name: null,
        designation_name: null
      })
    };
  } catch (e) {
    // A failure after createUser (employee insert, etc.) leaves an orphan
    // account: compensate with a best-effort delete so the next retry
    // doesn't hit "user already exists". Never mask a compensation failure
    // — the original error is what the caller must see. Mirrors the
    // contract in `users.ts:246-260`.
    if (createdUserId) {
      try {
        const { getRequestHeaders } = await import('@tanstack/react-start/server');
        const { auth } = await import('@/lib/auth/auth.server');
        await (auth.api as unknown as AdminAuthApi).removeUser({
          headers: getRequestHeaders(),
          body: { userId: createdUserId }
        });
      } catch (compensateError) {
        logger.error(
          { userId: createdUserId, err: compensateError },
          '[db:employees.createEmployee] orphan compensation failed'
        );
      }
    }
    mapDbError(e, 'employees.createEmployee');
  }
}

export const EMPLOYEE_TRACKED_CHANGE_REQUIRES_ACTOR = 'EMPLOYEE_TRACKED_CHANGE_REQUIRES_ACTOR';
export const EMPLOYEE_ALREADY_LINKED = 'EMPLOYEE_ALREADY_LINKED';
export const ONBOARD_LINK_WITH_PASSWORD = 'ONBOARD_LINK_WITH_PASSWORD';

/**
 * Single-action onboarding: provision the login account and the HR profile
 * together so a Pending state is never created. Fresh email → create the
 * auth user (generated or admin-set one-time credential, forced rotation)
 * plus the employee row atomically; orphan compensation deletes a
 * half-provisioned account on failure. Pre-existing Pending user → link the
 * profile onto it (and assign the access level) without touching its
 * credential — a provided password is rejected in this branch instead of
 * being silently ignored.
 */
export async function onboardEmployee(data: OnboardEmployeePayload & { created_by: string }) {
  // Set only in the fresh-user branch — the link branch must never rotate
  // or delete a pre-existing account.
  let createdUserId: string | null = null;
  try {
    const dataEmail = data.email.toLowerCase();

    const provided = data.password?.trim() || '';
    if (provided && provided.length < MIN_PASSWORD_LENGTH) {
      throw new DomainError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        'WEAK_PASSWORD'
      );
    }
    const generated = !provided;
    const initialPassword = generated ? generateTemporaryPassword() : provided;

    // Resolve the access level first so the fresh branch creates the auth
    // row with the final legacy role (no post-create sync needed). An
    // unknown group id is ignored, mirroring createUser.
    let syncedLegacyRole = 'employee';
    let linkedRoleGroup: { id: string; name: string } | null = null;
    if (data.role_group_id) {
      const { getRoleGroupById, mapRoleGroupToLegacyRole } = await import('./role-groups');
      const rg = await getRoleGroupById(data.role_group_id);
      if (rg.success) {
        syncedLegacyRole = mapRoleGroupToLegacyRole(rg.role_group!.name);
        linkedRoleGroup = { id: data.role_group_id, name: rg.role_group!.name };
      }
    }

    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, dataEmail))
      .limit(1);

    let userId: string;
    let linked = false;
    if (existingUser) {
      userId = existingUser.id;
      const [existingEmp] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, userId))
        .limit(1);
      if (existingEmp) {
        throw new DomainError(
          `Employee with email "${dataEmail}" is already registered`,
          EMPLOYEE_ALREADY_LINKED
        );
      }
      if (provided) {
        throw new DomainError(
          `Account "${dataEmail}" already exists — clear the password to link its profile, or replace its password from Users`,
          ONBOARD_LINK_WITH_PASSWORD
        );
      }
      linked = true;
      if (linkedRoleGroup) {
        const { setUserRoleGroup } = await import('./role-groups');
        await setUserRoleGroup(userId, linkedRoleGroup.id);
        const { getRequestHeaders } = await import('@tanstack/react-start/server');
        const { auth } = await import('@/lib/auth/auth.server');
        await (auth.api as unknown as AdminAuthApi).adminUpdateUser({
          headers: getRequestHeaders(),
          body: { userId, data: { role: syncedLegacyRole } }
        });
      }
    } else {
      const { auth } = await import('@/lib/auth/auth.server');
      const created = await (auth.api as unknown as AdminAuthApi).createUser({
        body: {
          email: dataEmail,
          name: data.full_name,
          password: initialPassword,
          role: syncedLegacyRole
        }
      });
      userId = created.id as string;
      createdUserId = userId;
      await setMustChangePassword(userId);
      if (linkedRoleGroup) {
        const { setUserRoleGroup } = await import('./role-groups');
        await setUserRoleGroup(userId, linkedRoleGroup.id);
      }
    }

    const employee_code = await generateEmployeeCode();

    const [inserted] = await db
      .insert(employees)
      .values({
        id: userId,
        employee_code,
        full_name: data.full_name,
        nickname: data.nickname ?? '',
        email: dataEmail,
        phone: data.phone ?? '',
        birth_place: data.birth_place ?? '',
        birth_date: data.birth_date,
        address: data.address ?? '',
        id_number: data.id_number ?? '',
        department_id: data.department_id,
        designation_id: data.designation_id,
        is_internship: data.is_internship ?? false,
        employment_status: data.employment_status ?? 'active',
        join_date: data.join_date,
        leave_date: data.leave_date ?? null,
        base_salary: data.base_salary ?? 0,
        status: data.status ?? 'active'
      })
      .returning();

    return {
      success: true,
      message: linked ? 'Employee profile linked successfully' : 'Employee onboarded successfully',
      employee: serialize({
        ...inserted,
        department_name: null,
        designation_name: null
      }),
      user: { id: userId, email: dataEmail, name: data.full_name },
      role_group: linkedRoleGroup,
      linked,
      // Single-use handoff for the credential dialog — fresh + generated
      // only. Never present when linking (no credential was set).
      ...(!linked && generated ? { generatedPassword: initialPassword } : {})
    };
  } catch (e) {
    if (createdUserId) {
      try {
        const { getRequestHeaders } = await import('@tanstack/react-start/server');
        const { auth } = await import('@/lib/auth/auth.server');
        await (auth.api as unknown as AdminAuthApi).removeUser({
          headers: getRequestHeaders(),
          body: { userId: createdUserId }
        });
      } catch (compensateError) {
        logger.error(
          { userId: createdUserId, err: compensateError },
          '[db:employees.onboardEmployee] orphan compensation failed'
        );
      }
    }
    mapDbError(e, 'employees.onboardEmployee');
  }
}

export async function updateEmployee(
  id: string,
  data: EmployeeMutationPayload,
  options: { actorUserId?: string; effectiveDate?: string } = {}
) {
  try {
    const existing = await getEmployeeOr404(id);
    if (!existing) {
      return { success: false, message: `Employee with ID ${id} not found` };
    }

    if (data.full_name !== existing.full_name || data.email !== existing.email) {
      const { getRequestHeaders } = await import('@tanstack/react-start/server');
      const { auth } = await import('@/lib/auth/auth.server');
      // Use the admin plugin's `/admin/update-user` endpoint (adminUpdateUser)
      // — the `updateUser` member on `auth.api` is the SELF-profile endpoint
      // that targets the session owner, not `id`. From a server context with
      // no session it would 401; even with a session it would silently update
      // the wrong row. The admin endpoint is keyed by `userId` and runs behind
      // adminMiddleware, so it requires the caller's headers.
      //
      // Deliberately NOT wrapped in a local try/catch: a failure here must
      // abort the whole update (the employees row must never drift out of
      // sync with user.email). The function's outer catch maps the error.
      await (auth.api as unknown as AdminAuthApi).adminUpdateUser({
        headers: getRequestHeaders(),
        body: {
          userId: id,
          data: {
            name: data.full_name,
            // Better Auth requires user:set-email to change email. The admin
            // plugin's middleware enforces that permission; without it this
            // throws FORBIDDEN (never silently dropped), which `mapDbError`
            // converts into a DomainError so the UI surfaces it.
            email: data.email
          }
        }
      });
    }

    // Dual-write path for the Career Timeline. Any change to one of the
    // three tracked columns (department_id, designation_id,
    // employment_status) flows through `appendCareerEventTx`, which writes
    // the matching employee_career_events row AND updates the column. The
    // legacy Edit Employee form and the new Career Timeline dialog share this
    // single code path (ADR-0007, ticket 04 acceptance criteria).
    //
    // The legacy form can change several tracked columns at once, so every
    // event insert AND the full employee UPDATE run inside ONE transaction:
    // a failure anywhere rolls back all of them (no partially-applied edit).
    const newEmploymentStatus = data.employment_status ?? 'active';
    const departmentChanged = data.department_id !== existing.department_id;
    const designationChanged = data.designation_id !== existing.designation_id;
    const employmentStatusChanged = newEmploymentStatus !== existing.employment_status;
    const hasTrackedChange = departmentChanged || designationChanged || employmentStatusChanged;

    // A tracked-column change MUST be attributable to an actor. Silently
    // skipping the timeline row (the pre-fix behaviour) lost the audit trail.
    if (hasTrackedChange && !options.actorUserId) {
      throw new DomainError(
        'An actor is required to record a department, designation, or employment-status change.',
        EMPLOYEE_TRACKED_CHANGE_REQUIRES_ACTOR
      );
    }
    const actorUserId = options.actorUserId;

    const effectiveDate = options.effectiveDate ?? businessDateInTimeZone(new Date());
    const notes: string | null = null;

    const { appendCareerEventTx } = await import('./career-timeline');

    const [updated] = await db.transaction(async (tx) => {
      if (departmentChanged && actorUserId) {
        await appendCareerEventTx(tx, {
          category: 'division',
          employeeId: id,
          toDepartmentId: data.department_id,
          effectiveDate,
          notes,
          actorUserId
        });
      }
      if (designationChanged && actorUserId) {
        await appendCareerEventTx(tx, {
          category: 'position',
          employeeId: id,
          toDesignationId: data.designation_id,
          effectiveDate,
          notes,
          actorUserId
        });
      }
      if (employmentStatusChanged && actorUserId) {
        await appendCareerEventTx(tx, {
          category: 'employment_status',
          employeeId: id,
          toLabel: newEmploymentStatus,
          effectiveDate,
          notes,
          actorUserId
        });
      }

      return tx
        .update(employees)
        .set({
          full_name: data.full_name,
          nickname: data.nickname ?? '',
          email: data.email,
          phone: data.phone ?? '',
          birth_place: data.birth_place ?? '',
          birth_date: data.birth_date,
          address: data.address ?? '',
          id_number: data.id_number ?? '',
          department_id: data.department_id,
          designation_id: data.designation_id,
          is_internship: data.is_internship ?? false,
          employment_status: newEmploymentStatus,
          join_date: data.join_date,
          leave_date: data.leave_date ?? null,
          base_salary: data.base_salary ?? 0,
          status: data.status ?? 'active',
          updated_at: new Date()
        })
        .where(eq(employees.id, id))
        .returning();
    });

    return {
      success: true,
      message: 'Employee updated successfully',
      employee: serialize({
        ...updated,
        department_name: null,
        designation_name: null
      })
    };
  } catch (e) {
    mapDbError(e, 'employees.updateEmployee');
  }
}

export async function deleteEmployee(id: string) {
  try {
    const existing = await getEmployeeOr404(id);
    if (!existing) {
      return {
        success: false,
        time: new Date().toISOString(),
        message: `Employee with ID ${id} not found`
      };
    }

    await db.delete(employees).where(eq(employees.id, id));

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Employee deleted successfully'
    };
  } catch (e) {
    mapDbError(e, 'employees.deleteEmployee');
    throw e;
  }
}
