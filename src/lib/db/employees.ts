import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { employees } from './schema/employees';
import { departments, designations } from './schema/masterdata';
import type {
  EmployeeFilters,
  EmployeesResponse,
  EmployeeByIdResponse,
  EmployeeMutationPayload
} from '@/features/employees/api/types';
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

type AuthUserRecord = { id: string; role?: string };
type AuthApi = {
  createUser: (opts: { body: Record<string, unknown> }) => Promise<AuthUserRecord>;
  updateUser: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
};

export async function createEmployee(data: EmployeeMutationPayload & { created_by: string }) {
  try {
    const { auth } = await import('@/lib/auth/auth.server');
    const created = await (auth.api as unknown as AuthApi).createUser({
      body: {
        email: data.email,
        name: data.full_name,
        password: 'ChangeMe123!',
        role: 'employee'
      }
    });

    const userId = created.id as string;
    const employee_code = await generateEmployeeCode();

    const [inserted] = await db
      .insert(employees)
      .values({
        id: userId,
        employee_code,
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
    mapDbError(e, 'employees.createEmployee');
  }
}

export async function updateEmployee(id: string, data: EmployeeMutationPayload) {
  try {
    const existing = await getEmployeeOr404(id);
    if (!existing) {
      return { success: false, message: `Employee with ID ${id} not found` };
    }

    if (data.full_name !== existing.full_name || data.email !== existing.email) {
      const { auth } = await import('@/lib/auth/auth.server');
      try {
        await (auth.api as unknown as AuthApi).updateUser({
          body: {
            id,
            name: data.full_name,
            email: data.email
          }
        });
      } catch {}
    }

    const [updated] = await db
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
        employment_status: data.employment_status ?? 'active',
        join_date: data.join_date,
        leave_date: data.leave_date ?? null,
        base_salary: data.base_salary ?? 0,
        status: data.status ?? 'active',
        updated_at: new Date()
      })
      .where(eq(employees.id, id))
      .returning();

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
