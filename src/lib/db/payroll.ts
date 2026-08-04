import { and, asc, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { db } from './index';
import { DomainError, mapDbError } from '../errors';
import {
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeEmploymentEvents,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  payrollPeriods,
  payrollRecords,
  salaryComponents,
  taxSettings
} from './schema/payroll';
import { employees } from './schema/employees';
import { departments, designations } from './schema/masterdata';
import { buildConditions, buildPagination, buildStatusCondition } from './utils';
import type {
  NewEmployeeSalaryAssignment,
  NewEmployeeSalaryComponent,
  NewEmployeeTaxProfile,
  NewPayrollPeriod,
  NewPayrollRecord,
  NewSalaryComponent
} from './schema/payroll';

type EffectiveRow = { id: number; effective_from: string; effective_to: string | null };

function assertDateRange(periodStart: string, periodEnd: string) {
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
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

async function effectiveAssignmentRows(employeeId: string, periodStart: string, periodEnd: string) {
  return db
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
  periodEnd: string
) {
  try {
    assertEmployeeId(employeeId);
    assertDateRange(periodStart, periodEnd);
    const row = requireEffectiveRecord(
      employeeId,
      periodStart,
      await effectiveAssignmentRows(employeeId, periodStart, periodEnd)
    );
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.getEffectiveSalaryAssignment');
  }
}

export async function getEffectiveSalaryComponents(
  employeeId: string,
  periodStart: string,
  periodEnd: string
) {
  try {
    const assignment = await getEffectiveSalaryAssignment(employeeId, periodStart, periodEnd);
    const rows = await db
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
    const grouped = new Map<number, (typeof rows)[number]>();
    for (const row of rows) {
      const existing = grouped.get(row.component.salary_component_id);
      const candidates = existing ? [existing.component, row.component] : [row.component];
      const active = candidates.filter(
        (component) =>
          component.effective_from <= periodStart &&
          (!component.effective_to || component.effective_to >= periodStart)
      );
      if (active.length > 1) {
        throw new DomainError(
          'Overlapping effective salary components.',
          'OVERLAPPING_EFFECTIVE_RECORDS'
        );
      }
      grouped.set(row.component.salary_component_id, row);
    }
    return [...grouped.values()];
  } catch (e) {
    mapDbError(e, 'payroll.getEffectiveSalaryComponents');
  }
}

export async function getEffectiveTaxProfile(employeeId: string, asOfDate: string) {
  try {
    assertEmployeeId(employeeId);
    const rows = await db
      .select()
      .from(employeeTaxProfiles)
      .where(
        and(
          eq(employeeTaxProfiles.employee_id, employeeId),
          lte(employeeTaxProfiles.effective_from, asOfDate)
        )
      )
      .orderBy(desc(employeeTaxProfiles.effective_from), desc(employeeTaxProfiles.id));
    return resolveEffectiveRecord(employeeId, asOfDate, rows);
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
    return await db
      .select()
      .from(employeeBenefitEnrollments)
      .where(
        effectiveWhere(
          employeeId,
          periodStart,
          periodEnd,
          employeeBenefitEnrollments.effective_from,
          employeeBenefitEnrollments.effective_to,
          employeeBenefitEnrollments.employee_id
        )
      )
      .orderBy(
        asc(employeeBenefitEnrollments.benefit_code),
        desc(employeeBenefitEnrollments.effective_from)
      );
  } catch (e) {
    mapDbError(e, 'payroll.getEffectiveBenefits');
  }
}

export async function getPrimaryBankAccount(employeeId: string) {
  try {
    assertEmployeeId(employeeId);
    const [row] = await db
      .select()
      .from(employeeBankAccounts)
      .where(
        and(
          eq(employeeBankAccounts.employee_id, employeeId),
          eq(employeeBankAccounts.is_primary, true)
        )
      )
      .limit(1);
    return row ?? null;
  } catch (e) {
    mapDbError(e, 'payroll.getPrimaryBankAccount');
  }
}

export async function getEmploymentContext(employeeId: string, asOfDate: string) {
  try {
    assertEmployeeId(employeeId);
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

export async function createSalaryAssignment(data: NewEmployeeSalaryAssignment) {
  try {
    assertDateRange(data.effective_from, data.effective_to ?? '9999-12-31');
    const existing = await db
      .select()
      .from(employeeSalaryAssignments)
      .where(eq(employeeSalaryAssignments.employee_id, data.employee_id));
    if (
      existing.some((row) =>
        rangesOverlap(data.effective_from, data.effective_to, row.effective_from, row.effective_to)
      )
    ) {
      throw new DomainError(
        'Salary assignment effective dates overlap.',
        'OVERLAPPING_EFFECTIVE_RECORDS'
      );
    }
    const [row] = await db.insert(employeeSalaryAssignments).values(data).returning();
    if (!row) throw new DomainError('Failed to create salary assignment.');
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.createSalaryAssignment');
  }
}

export async function createEmployeeTaxProfile(data: NewEmployeeTaxProfile) {
  try {
    const existing = await db
      .select()
      .from(employeeTaxProfiles)
      .where(eq(employeeTaxProfiles.employee_id, data.employee_id));
    if (
      existing.some((row) =>
        rangesOverlap(data.effective_from, data.effective_to, row.effective_from, row.effective_to)
      )
    ) {
      throw new DomainError(
        'Tax profile effective dates overlap.',
        'OVERLAPPING_EFFECTIVE_RECORDS'
      );
    }
    const [row] = await db.insert(employeeTaxProfiles).values(data).returning();
    if (!row) throw new DomainError('Failed to create tax profile.');
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.createEmployeeTaxProfile');
  }
}

export async function updateEmployeeTaxProfile(id: number, data: Partial<NewEmployeeTaxProfile>) {
  try {
    const [row] = await db
      .update(employeeTaxProfiles)
      .set({ ...data, updated_at: new Date() })
      .where(eq(employeeTaxProfiles.id, id))
      .returning();
    if (!row) throw new DomainError('Tax profile was not found.', 'NOT_FOUND');
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.updateEmployeeTaxProfile');
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

export async function updatePayrollPeriod(id: number, data: Partial<NewPayrollPeriod>) {
  try {
    const period = await getPayrollPeriod(id);
    if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
    assertPeriodMutable(period.status);
    const periodStart = data.period_start ?? period.period_start;
    const periodEnd = data.period_end ?? period.period_end;
    assertDateRange(periodStart, periodEnd);
    const [row] = await db
      .update(payrollPeriods)
      .set({ ...data, updated_at: new Date() })
      .where(eq(payrollPeriods.id, id))
      .returning();
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
    const period = await getPayrollPeriod(data.payroll_period_id);
    if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
    assertPeriodMutable(period.status);
    const [duplicate] = await db
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
    const [row] = await db.insert(payrollRecords).values(data).returning();
    if (!row) throw new DomainError('Failed to create payroll record.');
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.createPayrollRecord');
  }
}

export async function updatePayrollRecord(id: number, data: Partial<NewPayrollRecord>) {
  try {
    const [existing] = await db
      .select()
      .from(payrollRecords)
      .where(eq(payrollRecords.id, id))
      .limit(1);
    if (!existing) throw new DomainError('Payroll record was not found.', 'NOT_FOUND');
    const period = await getPayrollPeriod(existing.payroll_period_id);
    if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
    assertPeriodMutable(period.status);
    const [row] = await db
      .update(payrollRecords)
      .set({ ...data, updated_at: new Date() })
      .where(eq(payrollRecords.id, id))
      .returning();
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.updatePayrollRecord');
  }
}

export async function deletePayrollRecord(id: number) {
  try {
    const [existing] = await db
      .select()
      .from(payrollRecords)
      .where(eq(payrollRecords.id, id))
      .limit(1);
    if (!existing) return false;
    const period = await getPayrollPeriod(existing.payroll_period_id);
    if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
    assertPeriodMutable(period.status);
    await db.delete(payrollRecords).where(eq(payrollRecords.id, id));
    return true;
  } catch (e) {
    mapDbError(e, 'payroll.deletePayrollRecord');
  }
}

export async function generatePayrollRecords(periodId: number, records: NewPayrollRecord[]) {
  try {
    const period = await getPayrollPeriod(periodId);
    if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
    assertPeriodMutable(period.status);
    if (period.status !== 'draft') {
      throw new DomainError(
        'Payroll records can only be generated from a draft period.',
        'INVALID_PAYROLL_TRANSITION'
      );
    }
    const created = [];
    for (const record of records) {
      created.push(await createPayrollRecord({ ...record, payroll_period_id: periodId }));
    }
    await transitionPayrollPeriod(periodId, 'processing');
    return created;
  } catch (e) {
    mapDbError(e, 'payroll.generatePayrollRecords');
  }
}

export async function listPayrollRecords(
  filters: { payroll_period_id?: number; employee_id?: string; page?: number; limit?: number } = {}
) {
  try {
    assertEmployeeId(filters.employee_id);
    const { limit, offset } = buildPagination(filters);
    const where = buildConditions([
      eq(payrollRecords.employee_id, filters.employee_id),
      filters.payroll_period_id
        ? eq(payrollRecords.payroll_period_id, filters.payroll_period_id)
        : undefined
    ]);
    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(payrollRecords)
        .where(where)
        .orderBy(desc(payrollRecords.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(payrollRecords)
        .where(where)
    ]);
    return { rows, total: count, limit, offset };
  } catch (e) {
    mapDbError(e, 'payroll.listPayrollRecords');
  }
}

export async function transitionPayrollPeriod(
  id: number,
  nextStatus: 'processing' | 'ready_to_pay' | 'paid' | 'locked'
) {
  try {
    const period = await getPayrollPeriod(id);
    if (!period) throw new DomainError('Payroll period was not found.', 'NOT_FOUND');
    assertPayrollTransition(period.status, nextStatus);
    const [row] = await db
      .update(payrollPeriods)
      .set({
        status: nextStatus,
        processed_at: nextStatus === 'ready_to_pay' ? new Date() : period.processed_at,
        paid_at: nextStatus === 'paid' ? new Date() : period.paid_at,
        updated_at: new Date()
      })
      .where(eq(payrollPeriods.id, id))
      .returning();
    return row;
  } catch (e) {
    mapDbError(e, 'payroll.transitionPayrollPeriod');
  }
}

export const setPayrollPeriodStatus = transitionPayrollPeriod;
