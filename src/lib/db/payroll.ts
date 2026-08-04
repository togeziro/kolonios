import { and, asc, desc, eq, gte, getTableColumns, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from './index';
import { DomainError, mapDbError } from '../errors';
import {
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeEmploymentEvents,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  payslips,
  payrollPeriods,
  payrollRecords,
  salaryComponents
} from './schema/payroll';
import { employees } from './schema/employees';
import { departments, designations } from './schema/masterdata';
import { buildConditions, buildPagination, buildStatusCondition } from './utils';
import { auditLog } from './schema/audit-log';
import { getRequestId } from '../request-id';
import type {
  NewEmployeeSalaryAssignment,
  NewEmployeeSalaryComponent,
  NewEmployeeTaxProfile,
  NewPayrollPeriod,
  NewPayrollRecord,
  NewSalaryComponent
} from './schema/payroll';

type EffectiveRow = { id: number; effective_from: string; effective_to: string | null };
export type PayrollTransaction = any;

export async function withPayrollAuditTransaction<T>(
  actorUserId: string,
  entry: { action: string; entityType: string; entityId?: string | number; after?: unknown },
  operation: (tx: PayrollTransaction) => Promise<T>
) {
  try {
    return await db.transaction(async (tx) => {
      const result = await operation(tx);
      await tx.insert(auditLog).values({
        actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId == null ? null : String(entry.entityId),
        before: null,
        after: entry.after,
        requestId: getRequestId() ?? null
      });
      return result;
    });
  } catch (e) {
    mapDbError(e, `payroll.${entry.action}`);
  }
}

export function assertEffectiveDate(value: string) {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = match ? new Date(`${value}T00:00:00Z`) : new Date('invalid');
  if (!match || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new DomainError('A valid ISO calendar date is required.', 'INVALID_DATE');
  }
}

function assertDateRange(periodStart: string, periodEnd: string) {
  assertEffectiveDate(periodStart);
  assertEffectiveDate(periodEnd);
  if (periodStart > periodEnd) {
    throw new DomainError(
      'Payroll period start must be on or before its end.',
      'INVALID_DATE_RANGE'
    );
  }
}

export const validatePayrollDateRange = assertDateRange;

function assertEmployeeId(employeeId: string | undefined): asserts employeeId is string {
  if (!employeeId?.trim()) {
    throw new DomainError(
      'An employee ID is required for employee payroll reads.',
      'EMPLOYEE_SCOPE_REQUIRED'
    );
  }
}

export function assertEmployeeScope(employeeId: string | undefined): asserts employeeId is string {
  assertEmployeeId(employeeId);
}

/** Resolve an ordered effective-dated result while making overlap ambiguity explicit. */
export function resolveEffectiveRecord<T extends EffectiveRow>(
  employeeId: string,
  asOfDate: string,
  rows: T[]
): T | null {
  assertEffectiveDate(asOfDate);
  const active = rows.filter(
    (row) => row.effective_from <= asOfDate && (!row.effective_to || row.effective_to >= asOfDate)
  );
  if (active.length > 1) {
    throw new DomainError(
      `Overlapping effective payroll records for employee ${employeeId}.`,
      'OVERLAPPING_EFFECTIVE_RECORDS'
    );
  }
  return active[0] ?? null;
}

export function resolveEffectiveRecords<T extends EffectiveRow>(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  rows: T[]
) {
  assertDateRange(periodStart, periodEnd);
  const points = [
    periodStart,
    ...rows
      .map((row) => row.effective_from)
      .filter((date) => date > periodStart && date <= periodEnd)
  ].toSorted();
  const selected = new Map<number, T>();
  for (const point of points) {
    const row = resolveEffectiveRecord(employeeId, point, rows);
    if (row) selected.set(row.id, row);
  }
  return [...selected.values()].toSorted(
    (left, right) => left.effective_from.localeCompare(right.effective_from) || left.id - right.id
  );
}

export function requireEffectiveRecord<T extends EffectiveRow>(
  employeeId: string,
  asOfDate: string,
  rows: T[]
) {
  const row = resolveEffectiveRecord(employeeId, asOfDate, rows);
  if (!row)
    throw new DomainError(
      'Required payroll data is missing for this period.',
      'MISSING_PAYROLL_DATA'
    );
  return row;
}

function effectiveWhere(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  effectiveFrom: any,
  effectiveTo: any,
  employeeField: any
) {
  return and(
    eq(employeeField, employeeId),
    lte(effectiveFrom, periodEnd),
    or(sql`${effectiveTo} is null`, gte(effectiveTo, periodStart))
  );
}

async function effectiveAssignmentRows(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  tx?: PayrollTransaction
) {
  return (tx ?? db)
    .select()
    .from(employeeSalaryAssignments)
    .where(
      effectiveWhere(
        employeeId,
        periodStart,
        periodEnd,
        employeeSalaryAssignments.effective_from,
        employeeSalaryAssignments.effective_to,
        employeeSalaryAssignments.employee_id
      )
    )
    .orderBy(desc(employeeSalaryAssignments.effective_from), desc(employeeSalaryAssignments.id));
}

export async function getEffectiveSalaryAssignment(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  tx?: PayrollTransaction
): Promise<any> {
  try {
    assertEmployeeId(employeeId);
    assertDateRange(periodStart, periodEnd);
    const row = requireEffectiveRecord(
      employeeId,
      periodStart,
      await effectiveAssignmentRows(employeeId, periodStart, periodEnd, tx)
    );
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.getEffectiveSalaryAssignment');
  }
}

export async function getEffectiveSalaryComponents(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  tx?: PayrollTransaction
): Promise<any> {
  try {
    assertEmployeeId(employeeId);
    assertDateRange(periodStart, periodEnd);
    const assignments = resolveEffectiveRecords(
      employeeId,
      periodStart,
      periodEnd,
      await effectiveAssignmentRows(employeeId, periodStart, periodEnd, tx)
    );
    if (!assignments.length) {
      throw new DomainError(
        'Required payroll data is missing for this period.',
        'MISSING_PAYROLL_DATA'
      );
    }
    const resolved = [];
    for (const assignment of assignments) {
      const rows = await (tx ?? db)
        .select({ component: employeeSalaryComponents, definition: salaryComponents })
        .from(employeeSalaryComponents)
        .innerJoin(
          salaryComponents,
          eq(employeeSalaryComponents.salary_component_id, salaryComponents.id)
        )
        .where(
          and(
            eq(employeeSalaryComponents.assignment_id, assignment.id),
            lte(employeeSalaryComponents.effective_from, periodEnd),
            or(
              sql`${employeeSalaryComponents.effective_to} is null`,
              gte(employeeSalaryComponents.effective_to, periodStart)
            ),
            eq(salaryComponents.is_active, true)
          )
        )
        .orderBy(desc(employeeSalaryComponents.effective_from), desc(employeeSalaryComponents.id));
      const byComponent = new Map<number, (typeof rows)[number]['component'][]>();
      for (const row of rows) {
        const list = byComponent.get(row.component.salary_component_id) ?? [];
        list.push(row.component);
        byComponent.set(row.component.salary_component_id, list);
      }
      const definitions = new Map(rows.map((row: any) => [row.component.id, row.definition]));
      for (const componentRows of byComponent.values()) {
        for (const component of resolveEffectiveRecords(
          employeeId,
          periodStart,
          periodEnd,
          componentRows
        )) {
          resolved.push({ component, definition: definitions.get(component.id) });
        }
      }
    }
    return resolved;
  } catch (e) {
    mapDbError(e, 'payroll.getEffectiveSalaryComponents');
  }
}

export async function getEffectiveTaxProfile(
  employeeId: string,
  asOfDate: string,
  tx?: PayrollTransaction
): Promise<any> {
  try {
    assertEmployeeId(employeeId);
    assertEffectiveDate(asOfDate);
    const rows = await (tx ?? db)
      .select()
      .from(employeeTaxProfiles)
      .where(
        and(
          eq(employeeTaxProfiles.employee_id, employeeId),
          lte(employeeTaxProfiles.effective_from, asOfDate)
        )
      )
      .orderBy(desc(employeeTaxProfiles.effective_from), desc(employeeTaxProfiles.id));
    return requireEffectiveRecord(employeeId, asOfDate, rows);
  } catch (e) {
    mapDbError(e, 'payroll.getEffectiveTaxProfile');
  }
}

export async function getEffectiveBenefits(
  employeeId: string,
  periodStart: string,
  periodEnd: string
) {
  try {
    assertEmployeeId(employeeId);
    assertDateRange(periodStart, periodEnd);
    const rows = await db
      .select()
      .from(employeeBenefitEnrollments)
      .where(
        and(
          effectiveWhere(
            employeeId,
            periodStart,
            periodEnd,
            employeeBenefitEnrollments.effective_from,
            employeeBenefitEnrollments.effective_to,
            employeeBenefitEnrollments.employee_id
          ),
          eq(employeeBenefitEnrollments.status, 'active')
        )
      )
      .orderBy(
        asc(employeeBenefitEnrollments.benefit_code),
        desc(employeeBenefitEnrollments.effective_from)
      );
    const byBenefit = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byBenefit.get(row.benefit_code) ?? [];
      list.push(row);
      byBenefit.set(row.benefit_code, list);
    }
    return [...byBenefit.values()].flatMap((benefitRows) =>
      resolveEffectiveRecords(employeeId, periodStart, periodEnd, benefitRows)
    );
  } catch (e) {
    mapDbError(e, 'payroll.getEffectiveBenefits');
  }
}

export async function getPrimaryBankAccount(employeeId: string, asOfDate: string) {
  try {
    assertEmployeeId(employeeId);
    assertEffectiveDate(asOfDate);
    const rows = await db
      .select()
      .from(employeeBankAccounts)
      .where(
        and(
          eq(employeeBankAccounts.employee_id, employeeId),
          eq(employeeBankAccounts.is_primary, true),
          lte(employeeBankAccounts.effective_from, asOfDate),
          or(
            sql`${employeeBankAccounts.effective_to} is null`,
            gte(employeeBankAccounts.effective_to, asOfDate)
          )
        )
      )
      .orderBy(desc(employeeBankAccounts.effective_from), desc(employeeBankAccounts.id));
    return resolveEffectiveRecord(employeeId, asOfDate, rows);
  } catch (e) {
    mapDbError(e, 'payroll.getPrimaryBankAccount');
  }
}

export async function listEmployeePayrollProfileHistory(employeeId: string) {
  try {
    assertEmployeeId(employeeId);
    const [assignments, components, taxProfiles, benefits, bankAccounts] = await Promise.all([
      db
        .select()
        .from(employeeSalaryAssignments)
        .where(eq(employeeSalaryAssignments.employee_id, employeeId))
        .orderBy(
          desc(employeeSalaryAssignments.effective_from),
          desc(employeeSalaryAssignments.id)
        ),
      db
        .select({ component: employeeSalaryComponents, definition: salaryComponents })
        .from(employeeSalaryComponents)
        .innerJoin(
          salaryComponents,
          eq(employeeSalaryComponents.salary_component_id, salaryComponents.id)
        )
        .innerJoin(
          employeeSalaryAssignments,
          eq(employeeSalaryComponents.assignment_id, employeeSalaryAssignments.id)
        )
        .where(eq(employeeSalaryAssignments.employee_id, employeeId))
        .orderBy(desc(employeeSalaryComponents.effective_from), desc(employeeSalaryComponents.id)),
      listEmployeeTaxProfiles(employeeId),
      db
        .select()
        .from(employeeBenefitEnrollments)
        .where(eq(employeeBenefitEnrollments.employee_id, employeeId))
        .orderBy(
          desc(employeeBenefitEnrollments.effective_from),
          desc(employeeBenefitEnrollments.id)
        ),
      db
        .select()
        .from(employeeBankAccounts)
        .where(eq(employeeBankAccounts.employee_id, employeeId))
        .orderBy(desc(employeeBankAccounts.effective_from), desc(employeeBankAccounts.id))
    ]);
    return { assignments, components, taxProfiles, benefits, bankAccounts };
  } catch (e) {
    mapDbError(e, 'payroll.listEmployeePayrollProfileHistory');
  }
}

export async function getEmploymentContext(employeeId: string, asOfDate: string) {
  try {
    assertEmployeeId(employeeId);
    assertEffectiveDate(asOfDate);
    const [employee] = await db
      .select({ employee: employees, department: departments, designation: designations })
      .from(employees)
      .leftJoin(departments, eq(employees.department_id, departments.id))
      .leftJoin(designations, eq(employees.designation_id, designations.id))
      .where(eq(employees.id, employeeId))
      .limit(1);
    if (!employee) throw new DomainError('Employee was not found.', 'EMPLOYEE_NOT_FOUND');
    const events = await db
      .select()
      .from(employeeEmploymentEvents)
      .where(
        and(
          eq(employeeEmploymentEvents.employee_id, employeeId),
          lte(employeeEmploymentEvents.effective_date, asOfDate)
        )
      )
      .orderBy(desc(employeeEmploymentEvents.effective_date), desc(employeeEmploymentEvents.id));
    return { ...employee, events };
  } catch (e) {
    mapDbError(e, 'payroll.getEmploymentContext');
  }
}

export async function createSalaryComponent(data: NewSalaryComponent) {
  try {
    const [row] = await db.insert(salaryComponents).values(data).returning();
    if (!row) throw new DomainError('Failed to create salary component.');
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.createSalaryComponent');
  }
}

export async function getSalaryComponent(id: number) {
  try {
    const [row] = await db
      .select()
      .from(salaryComponents)
      .where(eq(salaryComponents.id, id))
      .limit(1);
    return row ?? null;
  } catch (e) {
    mapDbError(e, 'payroll.getSalaryComponent');
  }
}

export async function listSalaryComponents(includeInactive = false) {
  try {
    return await db
      .select()
      .from(salaryComponents)
      .where(includeInactive ? undefined : eq(salaryComponents.is_active, true))
      .orderBy(asc(salaryComponents.name));
  } catch (e) {
    mapDbError(e, 'payroll.listSalaryComponents');
  }
}

export async function updateSalaryComponent(
  id: number,
  data: Partial<typeof salaryComponents.$inferInsert>
) {
  try {
    const [row] = await db
      .update(salaryComponents)
      .set({ ...data, updated_at: new Date() })
      .where(eq(salaryComponents.id, id))
      .returning();
    if (!row) throw new DomainError('Salary component was not found.', 'NOT_FOUND');
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.updateSalaryComponent');
  }
}

export async function deleteSalaryComponent(id: number) {
  try {
    const [existing] = await db
      .select({ id: salaryComponents.id })
      .from(salaryComponents)
      .where(eq(salaryComponents.id, id))
      .limit(1);
    if (!existing) return false;
    await db.delete(salaryComponents).where(eq(salaryComponents.id, id));
    return true;
  } catch (e) {
    mapDbError(e, 'payroll.deleteSalaryComponent');
  }
}

export async function createSalaryAssignment(data: NewEmployeeSalaryAssignment) {
  try {
    assertDateRange(data.effective_from, data.effective_to ?? '9999-12-31');
    return await db.transaction(async (tx) => {
      const employee = await lockEmployee(tx, data.employee_id);
      if (!employee) throw new DomainError('Employee was not found.', 'EMPLOYEE_NOT_FOUND');
      const existing = await tx
        .select()
        .from(employeeSalaryAssignments)
        .where(eq(employeeSalaryAssignments.employee_id, data.employee_id));
      if (
        existing.some((row) =>
          rangesOverlap(
            data.effective_from,
            data.effective_to,
            row.effective_from,
            row.effective_to
          )
        )
      ) {
        throw new DomainError(
          'Salary assignment effective dates overlap.',
          'OVERLAPPING_EFFECTIVE_RECORDS'
        );
      }
      const [row] = await tx.insert(employeeSalaryAssignments).values(data).returning();
      if (!row) throw new DomainError('Failed to create salary assignment.');
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.createSalaryAssignment');
  }
}

export async function updateSalaryAssignment(
  id: number,
  data: Partial<NewEmployeeSalaryAssignment>
) {
  try {
    const [existing] = await db
      .select()
      .from(employeeSalaryAssignments)
      .where(eq(employeeSalaryAssignments.id, id))
      .limit(1);
    if (!existing) throw new DomainError('Salary assignment was not found.', 'NOT_FOUND');
    if (data.employee_id !== undefined && data.employee_id !== existing.employee_id) {
      throw new DomainError('Salary assignment employee is immutable.', 'IMMUTABLE_PAYROLL_RECORD');
    }
    const next = { ...existing, ...data };
    assertDateRange(next.effective_from, next.effective_to ?? '9999-12-31');
    return await db.transaction(async (tx) => {
      const employee = await lockEmployee(tx, existing.employee_id);
      if (!employee) throw new DomainError('Employee was not found.', 'EMPLOYEE_NOT_FOUND');
      const siblings = await tx
        .select()
        .from(employeeSalaryAssignments)
        .where(eq(employeeSalaryAssignments.employee_id, next.employee_id));
      if (
        siblings.some(
          (row) =>
            row.id !== id &&
            rangesOverlap(
              next.effective_from,
              next.effective_to,
              row.effective_from,
              row.effective_to
            )
        )
      ) {
        throw new DomainError(
          'Salary assignment effective dates overlap.',
          'OVERLAPPING_EFFECTIVE_RECORDS'
        );
      }
      const [row] = await tx
        .update(employeeSalaryAssignments)
        .set({ ...data, updated_at: new Date() })
        .where(eq(employeeSalaryAssignments.id, id))
        .returning();
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.updateSalaryAssignment');
  }
}

export async function deleteSalaryAssignment(id: number) {
  try {
    const [existing] = await db
      .select({ id: employeeSalaryAssignments.id })
      .from(employeeSalaryAssignments)
      .where(eq(employeeSalaryAssignments.id, id))
      .limit(1);
    if (!existing) return false;
    await db.delete(employeeSalaryAssignments).where(eq(employeeSalaryAssignments.id, id));
    return true;
  } catch (e) {
    mapDbError(e, 'payroll.deleteSalaryAssignment');
  }
}

export async function createEmployeeSalaryComponent(data: NewEmployeeSalaryComponent) {
  try {
    assertDateRange(data.effective_from, data.effective_to ?? '9999-12-31');
    return await db.transaction(async (tx) => {
      const assignment = await lockSalaryAssignment(tx, data.assignment_id);
      if (!assignment) throw new DomainError('Salary assignment was not found.', 'NOT_FOUND');
      const existing = await tx
        .select()
        .from(employeeSalaryComponents)
        .where(
          and(
            eq(employeeSalaryComponents.assignment_id, data.assignment_id),
            eq(employeeSalaryComponents.salary_component_id, data.salary_component_id)
          )
        );
      if (
        existing.some((row) =>
          rangesOverlap(
            data.effective_from,
            data.effective_to,
            row.effective_from,
            row.effective_to
          )
        )
      ) {
        throw new DomainError(
          'Salary component effective dates overlap.',
          'OVERLAPPING_EFFECTIVE_RECORDS'
        );
      }
      const [row] = await tx.insert(employeeSalaryComponents).values(data).returning();
      if (!row) throw new DomainError('Failed to create employee salary component.');
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.createEmployeeSalaryComponent');
  }
}

export async function updateEmployeeSalaryComponent(
  id: number,
  data: Partial<NewEmployeeSalaryComponent>
) {
  try {
    const [existing] = await db
      .select()
      .from(employeeSalaryComponents)
      .where(eq(employeeSalaryComponents.id, id))
      .limit(1);
    if (!existing) throw new DomainError('Employee salary component was not found.', 'NOT_FOUND');
    if (
      (data.assignment_id !== undefined && data.assignment_id !== existing.assignment_id) ||
      (data.salary_component_id !== undefined &&
        data.salary_component_id !== existing.salary_component_id)
    ) {
      throw new DomainError('Salary component identity is immutable.', 'IMMUTABLE_PAYROLL_RECORD');
    }
    const next = { ...existing, ...data };
    assertDateRange(next.effective_from, next.effective_to ?? '9999-12-31');
    return await db.transaction(async (tx) => {
      const assignment = await lockSalaryAssignment(tx, existing.assignment_id);
      if (!assignment) throw new DomainError('Salary assignment was not found.', 'NOT_FOUND');
      const siblings = await tx
        .select()
        .from(employeeSalaryComponents)
        .where(
          and(
            eq(employeeSalaryComponents.assignment_id, next.assignment_id),
            eq(employeeSalaryComponents.salary_component_id, next.salary_component_id)
          )
        );
      if (
        siblings.some(
          (row) =>
            row.id !== id &&
            rangesOverlap(
              next.effective_from,
              next.effective_to,
              row.effective_from,
              row.effective_to
            )
        )
      ) {
        throw new DomainError(
          'Salary component effective dates overlap.',
          'OVERLAPPING_EFFECTIVE_RECORDS'
        );
      }
      const [row] = await tx
        .update(employeeSalaryComponents)
        .set({ ...data, updated_at: new Date() })
        .where(eq(employeeSalaryComponents.id, id))
        .returning();
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.updateEmployeeSalaryComponent');
  }
}

export async function deleteEmployeeSalaryComponent(id: number) {
  try {
    const [existing] = await db
      .select({ id: employeeSalaryComponents.id })
      .from(employeeSalaryComponents)
      .where(eq(employeeSalaryComponents.id, id))
      .limit(1);
    if (!existing) return false;
    await db.delete(employeeSalaryComponents).where(eq(employeeSalaryComponents.id, id));
    return true;
  } catch (e) {
    mapDbError(e, 'payroll.deleteEmployeeSalaryComponent');
  }
}

export async function createEmployeeTaxProfile(data: NewEmployeeTaxProfile) {
  try {
    assertDateRange(data.effective_from, data.effective_to ?? '9999-12-31');
    return await db.transaction(async (tx) => {
      const employee = await lockEmployee(tx, data.employee_id);
      if (!employee) throw new DomainError('Employee was not found.', 'EMPLOYEE_NOT_FOUND');
      const existing = await tx
        .select()
        .from(employeeTaxProfiles)
        .where(eq(employeeTaxProfiles.employee_id, data.employee_id));
      if (
        existing.some((row) =>
          rangesOverlap(
            data.effective_from,
            data.effective_to,
            row.effective_from,
            row.effective_to
          )
        )
      ) {
        throw new DomainError(
          'Tax profile effective dates overlap.',
          'OVERLAPPING_EFFECTIVE_RECORDS'
        );
      }
      const [row] = await tx.insert(employeeTaxProfiles).values(data).returning();
      if (!row) throw new DomainError('Failed to create tax profile.');
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.createEmployeeTaxProfile');
  }
}

export async function updateEmployeeTaxProfile(id: number, data: Partial<NewEmployeeTaxProfile>) {
  try {
    const [existing] = await db
      .select()
      .from(employeeTaxProfiles)
      .where(eq(employeeTaxProfiles.id, id))
      .limit(1);
    if (!existing) throw new DomainError('Tax profile was not found.', 'NOT_FOUND');
    if (data.employee_id !== undefined && data.employee_id !== existing.employee_id) {
      throw new DomainError('Tax profile employee is immutable.', 'IMMUTABLE_PAYROLL_RECORD');
    }
    const next = { ...existing, ...data };
    assertDateRange(next.effective_from, next.effective_to ?? '9999-12-31');
    return await db.transaction(async (tx) => {
      const employee = await lockEmployee(tx, existing.employee_id);
      if (!employee) throw new DomainError('Employee was not found.', 'EMPLOYEE_NOT_FOUND');
      const siblings = await tx
        .select()
        .from(employeeTaxProfiles)
        .where(eq(employeeTaxProfiles.employee_id, next.employee_id));
      if (
        siblings.some(
          (row) =>
            row.id !== id &&
            rangesOverlap(
              next.effective_from,
              next.effective_to,
              row.effective_from,
              row.effective_to
            )
        )
      ) {
        throw new DomainError(
          'Tax profile effective dates overlap.',
          'OVERLAPPING_EFFECTIVE_RECORDS'
        );
      }
      const [row] = await tx
        .update(employeeTaxProfiles)
        .set({ ...data, updated_at: new Date() })
        .where(eq(employeeTaxProfiles.id, id))
        .returning();
      if (!row) throw new DomainError('Tax profile was not found.', 'NOT_FOUND');
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.updateEmployeeTaxProfile');
  }
}

export async function getEmployeeTaxProfile(id: number) {
  try {
    const [row] = await db
      .select()
      .from(employeeTaxProfiles)
      .where(eq(employeeTaxProfiles.id, id))
      .limit(1);
    return row ?? null;
  } catch (e) {
    mapDbError(e, 'payroll.getEmployeeTaxProfile');
  }
}

export async function listEmployeeTaxProfiles(employeeId: string) {
  try {
    assertEmployeeId(employeeId);
    return await db
      .select()
      .from(employeeTaxProfiles)
      .where(eq(employeeTaxProfiles.employee_id, employeeId))
      .orderBy(desc(employeeTaxProfiles.effective_from), desc(employeeTaxProfiles.id));
  } catch (e) {
    mapDbError(e, 'payroll.listEmployeeTaxProfiles');
  }
}

export const getTaxProfile = getEmployeeTaxProfile;
export const listTaxProfiles = listEmployeeTaxProfiles;
export const deleteTaxProfile = deleteEmployeeTaxProfile;
export const updateEmployeeSalaryAssignment = updateSalaryAssignment;
export const deleteEmployeeSalaryAssignment = deleteSalaryAssignment;

export async function deleteEmployeeTaxProfile(id: number) {
  try {
    const [existing] = await db
      .select({ id: employeeTaxProfiles.id })
      .from(employeeTaxProfiles)
      .where(eq(employeeTaxProfiles.id, id))
      .limit(1);
    if (!existing) return false;
    await db.delete(employeeTaxProfiles).where(eq(employeeTaxProfiles.id, id));
    return true;
  } catch (e) {
    mapDbError(e, 'payroll.deleteEmployeeTaxProfile');
  }
}

function rangesOverlap(
  aStart: string,
  aEnd: string | null | undefined,
  bStart: string,
  bEnd: string | null
) {
  return aStart <= (bEnd ?? '9999-12-31') && bStart <= (aEnd ?? '9999-12-31');
}

function assertPeriodMutable(status: string) {
  if (status === 'locked')
    throw new DomainError('Locked payroll periods cannot be mutated.', 'LOCKED_PERIOD');
}

export function assertPayrollPeriodUpdate(
  currentStatus: string,
  data: { status?: string; [key: string]: unknown }
) {
  if (currentStatus === 'locked') {
    throw new DomainError('Locked payroll periods cannot be mutated.', 'LOCKED_PERIOD');
  }
  if (data.status && data.status !== currentStatus) {
    assertPayrollTransition(currentStatus, data.status as 'processing');
  }
}

export function assertPayrollRecordMutation(
  data: {
    id?: number;
    employee_id?: string;
    payroll_period_id?: number;
    created_at?: Date;
    updated_at?: Date;
  },
  _employeeId: string,
  _periodId: number
) {
  if (
    data.id !== undefined ||
    data.employee_id !== undefined ||
    data.payroll_period_id !== undefined ||
    data.created_at !== undefined ||
    data.updated_at !== undefined
  ) {
    throw new DomainError(
      'Payroll record employee and period are immutable.',
      'IMMUTABLE_PAYROLL_RECORD'
    );
  }
}

export function assertPayrollTransition(
  currentStatus: string,
  nextStatus: 'processing' | 'ready_to_pay' | 'paid' | 'locked'
) {
  if (currentStatus === 'locked')
    throw new DomainError('Locked payroll periods cannot transition.', 'LOCKED_PERIOD');
  const allowed: Record<string, string[]> = {
    draft: ['processing'],
    processing: ['ready_to_pay'],
    ready_to_pay: ['paid'],
    paid: ['locked']
  };
  if (!allowed[currentStatus]?.includes(nextStatus)) {
    throw new DomainError(
      `Invalid payroll transition from ${currentStatus} to ${nextStatus}.`,
      'INVALID_PAYROLL_TRANSITION'
    );
  }
}

export function assertPayrollRecordUnique(duplicateExists: boolean) {
  if (duplicateExists) {
    throw new DomainError(
      'Duplicate payroll record for this employee and period.',
      'DUPLICATE_PAYROLL_RECORD'
    );
  }
}

export async function createPayrollPeriod(data: NewPayrollPeriod) {
  try {
    assertDateRange(data.period_start, data.period_end);
    if (data.status && data.status !== 'draft') {
      throw new DomainError(
        'Payroll periods must start in draft state.',
        'INVALID_PAYROLL_TRANSITION'
      );
    }
    const [row] = await db.insert(payrollPeriods).values(data).returning();
    if (!row) throw new DomainError('Failed to create payroll period.');
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.createPayrollPeriod');
  }
}

export async function getPayrollPeriod(id: number) {
  try {
    const [row] = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, id)).limit(1);
    return row ?? null;
  } catch (e) {
    mapDbError(e, 'payroll.getPayrollPeriod');
  }
}

export async function deletePayrollPeriod(id: number) {
  try {
    return await db.transaction(async (tx) => {
      const period = await lockPayrollPeriod(tx, id);
      if (!period) return false;
      assertPeriodMutable(period.status);
      await tx.delete(payrollPeriods).where(eq(payrollPeriods.id, id));
      return true;
    });
  } catch (e) {
    mapDbError(e, 'payroll.deletePayrollPeriod');
  }
}

export async function updatePayrollPeriod(id: number, data: Partial<NewPayrollPeriod>) {
  try {
    const period = await getPayrollPeriod(id);
    if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
    assertPayrollPeriodUpdate(period.status, data);
    const periodStart = data.period_start ?? period.period_start;
    const periodEnd = data.period_end ?? period.period_end;
    assertDateRange(periodStart, periodEnd);
    const [row] = await db
      .update(payrollPeriods)
      .set({ ...data, updated_at: new Date() })
      .where(and(eq(payrollPeriods.id, id), eq(payrollPeriods.status, period.status)))
      .returning();
    if (!row) {
      throw new DomainError('Payroll period changed during the update.', 'CONCURRENT_MODIFICATION');
    }
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.updatePayrollPeriod');
  }
}

export async function listPayrollPeriods(
  filters: { status?: string; page?: number; limit?: number } = {}
) {
  try {
    const { limit, offset } = buildPagination(filters);
    const where = buildStatusCondition(payrollPeriods.status, filters.status);
    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(payrollPeriods)
        .where(where)
        .orderBy(desc(payrollPeriods.period_start))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payrollPeriods)
        .where(where)
    ]);
    return { rows, total: count, limit, offset };
  } catch (e) {
    mapDbError(e, 'payroll.listPayrollPeriods');
  }
}

export async function createPayrollRecord(data: NewPayrollRecord) {
  try {
    const employeeId = data.employee_id;
    assertEmployeeScope(employeeId);
    return await db.transaction(async (tx) => {
      const period = await lockPayrollPeriod(tx, data.payroll_period_id);
      if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
      assertPeriodMutable(period.status);
      const [duplicate] = await tx
        .select({ id: payrollRecords.id })
        .from(payrollRecords)
        .where(
          and(
            eq(payrollRecords.payroll_period_id, data.payroll_period_id),
            eq(payrollRecords.employee_id, employeeId)
          )
        )
        .limit(1);
      assertPayrollRecordUnique(Boolean(duplicate));
      const [row] = await tx.insert(payrollRecords).values(data).returning();
      if (!row) throw new DomainError('Failed to create payroll record.');
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.createPayrollRecord');
  }
}

export async function getPayrollRecord(id: number, employeeId?: string) {
  try {
    if (employeeId !== undefined) assertEmployeeId(employeeId);
    const where = buildConditions([
      eq(payrollRecords.id, id),
      employeeId ? eq(payrollRecords.employee_id, employeeId) : undefined
    ]);
    const [row] = await db.select().from(payrollRecords).where(where).limit(1);
    return row ?? null;
  } catch (e) {
    mapDbError(e, 'payroll.getPayrollRecord');
  }
}

async function getPayrollRecordForTransaction(tx: any, id: number) {
  const [row] = await tx.select().from(payrollRecords).where(eq(payrollRecords.id, id)).limit(1);
  return row ?? null;
}

export async function lockPayrollPeriod(tx: PayrollTransaction, id: number) {
  await tx.execute(
    sql`select ${payrollPeriods.id} from ${payrollPeriods} where ${payrollPeriods.id} = ${id} for update`
  );
  const [period] = await tx.select().from(payrollPeriods).where(eq(payrollPeriods.id, id)).limit(1);
  return period ?? null;
}

async function lockEmployee(tx: any, employeeId: string) {
  await tx.execute(
    sql`select ${employees.id} from ${employees} where ${employees.id} = ${employeeId} for update`
  );
  const [employee] = await tx.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  return employee ?? null;
}

async function lockSalaryAssignment(tx: any, assignmentId: number) {
  await tx.execute(
    sql`select ${employeeSalaryAssignments.id} from ${employeeSalaryAssignments} where ${employeeSalaryAssignments.id} = ${assignmentId} for update`
  );
  const [assignment] = await tx
    .select()
    .from(employeeSalaryAssignments)
    .where(eq(employeeSalaryAssignments.id, assignmentId))
    .limit(1);
  return assignment ?? null;
}

export async function updatePayrollRecord(id: number, data: Partial<NewPayrollRecord>) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await getPayrollRecordForTransaction(tx, id);
      if (!existing) throw new DomainError('Payroll record was not found.', 'NOT_FOUND');
      assertPayrollRecordMutation(data, existing.employee_id, existing.payroll_period_id);
      const period = await lockPayrollPeriod(tx, existing.payroll_period_id);
      if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
      assertPeriodMutable(period.status);
      const [row] = await tx
        .update(payrollRecords)
        .set({ ...data, updated_at: new Date() })
        .where(
          and(
            eq(payrollRecords.id, id),
            eq(payrollRecords.payroll_period_id, existing.payroll_period_id),
            eq(payrollRecords.employee_id, existing.employee_id)
          )
        )
        .returning();
      if (!row)
        throw new DomainError(
          'Payroll record changed during the update.',
          'CONCURRENT_MODIFICATION'
        );
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.updatePayrollRecord');
  }
}

export async function deletePayrollRecord(id: number) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await getPayrollRecordForTransaction(tx, id);
      if (!existing) return false;
      const period = await lockPayrollPeriod(tx, existing.payroll_period_id);
      if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
      assertPeriodMutable(period.status);
      await tx
        .delete(payrollRecords)
        .where(
          and(
            eq(payrollRecords.id, id),
            eq(payrollRecords.payroll_period_id, existing.payroll_period_id),
            eq(payrollRecords.employee_id, existing.employee_id)
          )
        );
      return true;
    });
  } catch (e) {
    mapDbError(e, 'payroll.deletePayrollRecord');
  }
}

export async function generatePayrollRecords(periodId: number, records: NewPayrollRecord[]) {
  try {
    return await db.transaction(async (tx) => {
      const period = await lockPayrollPeriod(tx, periodId);
      if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
      assertPayrollTransition(period.status, 'processing');
      const employeeIds = new Set<string>();
      const created = [];
      for (const record of records) {
        assertEmployeeScope(record.employee_id);
        if (employeeIds.has(record.employee_id)) assertPayrollRecordUnique(true);
        employeeIds.add(record.employee_id);
        const [duplicate] = await tx
          .select({ id: payrollRecords.id })
          .from(payrollRecords)
          .where(
            and(
              eq(payrollRecords.payroll_period_id, periodId),
              eq(payrollRecords.employee_id, record.employee_id)
            )
          )
          .limit(1);
        assertPayrollRecordUnique(Boolean(duplicate));
        const [row] = await tx
          .insert(payrollRecords)
          .values({ ...record, payroll_period_id: periodId })
          .returning();
        if (!row) throw new DomainError('Failed to create payroll record.');
        created.push(row);
      }
      const [updatedPeriod] = await tx
        .update(payrollPeriods)
        .set({ status: 'processing', updated_at: new Date() })
        .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.status, period.status)))
        .returning();
      if (!updatedPeriod) {
        throw new DomainError(
          'Payroll period changed during generation.',
          'CONCURRENT_MODIFICATION'
        );
      }
      return created;
    });
  } catch (e) {
    mapDbError(e, 'payroll.generatePayrollRecords');
  }
}

export async function listPayrollRecords(
  filters: {
    payroll_period_id?: number;
    employee_id?: string;
    department_id?: number;
    status?: string;
    statuses?: string[];
    scope?: 'admin' | 'employee';
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const scope = filters.scope ?? (filters.employee_id ? 'employee' : 'admin');
    if (scope === 'employee') assertEmployeeId(filters.employee_id);
    const { limit, offset } = buildPagination(filters);
    const where = buildConditions([
      filters.employee_id ? eq(payrollRecords.employee_id, filters.employee_id) : undefined,
      filters.payroll_period_id
        ? eq(payrollRecords.payroll_period_id, filters.payroll_period_id)
        : undefined,
      filters.department_id ? eq(employees.department_id, filters.department_id) : undefined,
      filters.status
        ? eq(
            payrollPeriods.status,
            filters.status as 'draft' | 'processing' | 'ready_to_pay' | 'paid' | 'locked'
          )
        : undefined,
      filters.statuses?.length
        ? inArray(
            payrollPeriods.status,
            filters.statuses as Array<'draft' | 'processing' | 'ready_to_pay' | 'paid' | 'locked'>
          )
        : undefined
    ]);
    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          ...getTableColumns(payrollRecords),
          period_status: payrollPeriods.status,
          period_name: payrollPeriods.name,
          period_start: payrollPeriods.period_start,
          period_end: payrollPeriods.period_end,
          payment_date: payrollPeriods.payment_date,
          employee_code: employees.employee_code,
          employee_name: employees.full_name,
          department_name: departments.name,
          designation_name: designations.name,
          payslip_number: payslips.payslip_number,
          payslip_issued_at: payslips.issued_at
        })
        .from(payrollRecords)
        .innerJoin(payrollPeriods, eq(payrollRecords.payroll_period_id, payrollPeriods.id))
        .innerJoin(employees, eq(payrollRecords.employee_id, employees.id))
        .leftJoin(departments, eq(employees.department_id, departments.id))
        .leftJoin(designations, eq(employees.designation_id, designations.id))
        .leftJoin(
          payslips,
          and(
            eq(payslips.payroll_record_id, payrollRecords.id),
            eq(payslips.employee_id, payrollRecords.employee_id)
          )
        )
        .where(where)
        .orderBy(desc(payrollRecords.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payrollRecords)
        .innerJoin(payrollPeriods, eq(payrollRecords.payroll_period_id, payrollPeriods.id))
        .innerJoin(employees, eq(payrollRecords.employee_id, employees.id))
        .where(where)
    ]);
    return { rows, total: count, limit, offset };
  } catch (e) {
    mapDbError(e, 'payroll.listPayrollRecords');
  }
}

export async function listPayrollReportRows(
  filters: {
    payroll_period_id?: number;
    employee_id?: string;
    department_id?: number;
    status?: string;
  } = {}
) {
  try {
    const where = buildConditions([
      filters.employee_id ? eq(payrollRecords.employee_id, filters.employee_id) : undefined,
      filters.payroll_period_id
        ? eq(payrollRecords.payroll_period_id, filters.payroll_period_id)
        : undefined,
      filters.department_id ? eq(employees.department_id, filters.department_id) : undefined,
      filters.status
        ? eq(
            payrollPeriods.status,
            filters.status as 'draft' | 'processing' | 'ready_to_pay' | 'paid' | 'locked'
          )
        : undefined
    ]);
    return await db
      .select({
        ...getTableColumns(payrollRecords),
        period_status: payrollPeriods.status,
        department_name: departments.name
      })
      .from(payrollRecords)
      .innerJoin(payrollPeriods, eq(payrollRecords.payroll_period_id, payrollPeriods.id))
      .innerJoin(employees, eq(payrollRecords.employee_id, employees.id))
      .leftJoin(departments, eq(employees.department_id, departments.id))
      .where(where)
      .orderBy(desc(payrollRecords.id));
  } catch (e) {
    mapDbError(e, 'payroll.listPayrollReportRows');
  }
}

export async function transitionPayrollPeriod(
  id: number,
  nextStatus: 'processing' | 'ready_to_pay' | 'paid' | 'locked'
) {
  try {
    return await db.transaction(async (tx) => {
      const period = await lockPayrollPeriod(tx, id);
      if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
      assertPayrollTransition(period.status, nextStatus);
      const [row] = await tx
        .update(payrollPeriods)
        .set({
          status: nextStatus,
          processed_at: nextStatus === 'ready_to_pay' ? new Date() : period.processed_at,
          paid_at: nextStatus === 'paid' ? new Date() : period.paid_at,
          updated_at: new Date()
        })
        .where(and(eq(payrollPeriods.id, id), eq(payrollPeriods.status, period.status)))
        .returning();
      if (!row) {
        throw new DomainError(
          'Payroll period changed during transition.',
          'CONCURRENT_MODIFICATION'
        );
      }
      return row;
    });
  } catch (e) {
    mapDbError(e, 'payroll.transitionPayrollPeriod');
  }
}

export const setPayrollPeriodStatus = transitionPayrollPeriod;
