// Shared helpers for database integration tests.
//
// The data-access modules in src/lib/db connect to the test database via the
// DATABASE_URL set in vite.config.ts / vitest.setup.ts. These helpers let each
// test start from a clean, known state by truncating every table and seeding
// only what the test needs.
import { db } from '@/lib/db';
import { eq, max } from 'drizzle-orm';
import {
  nationalHolidays,
  attendanceCorrections,
  leaveTypeConfigs,
  dayOffs,
  dateOverrides,
  scheduleAssignments,
  shiftWeekdayRules,
  employeeShifts,
  leaves,
  performanceReports,
  locations,
  shifts
} from '@/lib/db/schema/attendance';
import { customers } from '@/lib/db/schema/customers';
import { departments, designations } from '@/lib/db/schema/masterdata';
import { employees } from '@/lib/db/schema/employees';
import { notifications } from '@/lib/db/schema/notifications';
import {
  tickets,
  ticketLegs,
  ticketMaterials,
  ticketPhotos,
  taskRequirements,
  employeeSkills
} from '@/lib/db/schema/tickets';
import { user, session, account, verification } from '@/lib/db/auth-schema';
import { auditLog } from '@/lib/db/schema/audit-log';
import { roleGroups } from '@/lib/db/schema/role-groups';
import { userRoleGroups } from '@/lib/db/schema/user-role-groups';
import {
  salaryComponents,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  payrollPeriods,
  payrollRecords,
  payslips,
  taxSettings,
  employeeTaxProfiles,
  employeeTaxRecords,
  employeeBenefitEnrollments,
  employeeBankAccounts,
  employeeEmploymentEvents,
  employeeDocuments,
  companyPayrollSettings,
  employeeBpjsEnrollments,
  employeeBpjsFamilyMembers,
  payrollAttendanceOverrides
} from '@/lib/db/schema/payroll';

export async function resetDatabase() {
  await db.delete(notifications);
  await db.delete(roleGroups);
}

export async function resetAllTables() {
  // Delete in correct order (child tables before parent tables)
  await db.delete(payrollAttendanceOverrides);
  await db.delete(employeeBpjsFamilyMembers);
  await db.delete(employeeBpjsEnrollments);
  await db.delete(employeeDocuments);
  await db.delete(employeeEmploymentEvents);
  await db.delete(employeeBankAccounts);
  await db.delete(employeeBenefitEnrollments);
  await db.delete(employeeTaxRecords);
  await db.delete(employeeTaxProfiles);
  await db.delete(payslips);
  await db.delete(payrollRecords);
  await db.delete(payrollPeriods);
  await db.delete(employeeSalaryComponents);
  await db.delete(employeeSalaryAssignments);
  await db.delete(salaryComponents);
  await db.delete(companyPayrollSettings);
  await db.delete(taxSettings);
  await db.delete(nationalHolidays);
  await db.delete(attendanceCorrections);
  await db.delete(leaveTypeConfigs);
  await db.delete(dayOffs);
  await db.delete(dateOverrides);
  await db.delete(scheduleAssignments);
  await db.delete(shiftWeekdayRules);
  await db.delete(auditLog);
  await db.delete(employeeShifts);
  await db.delete(leaves);
  await db.delete(performanceReports);
  await db.delete(ticketMaterials);
  await db.delete(ticketPhotos);
  await db.delete(ticketLegs);
  await db.delete(employeeSkills);
  await db.delete(taskRequirements);
  await db.delete(tickets);
  await db.delete(customers);
  await db.delete(employees);
  await db.delete(designations);
  await db.delete(departments);
  await db.delete(locations);
  await db.delete(shifts);
  await db.delete(notifications);
  await db.delete(userRoleGroups);
  await db.delete(roleGroups);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(user);
}

export async function seedUser(id: string, overrides: Partial<typeof user.$inferInsert> = {}) {
  await db.insert(user).values({
    id,
    name: 'Test User',
    email: `${id}@test.com`,
    role: 'employee',
    emailVerified: true,
    ...overrides
  });
}

export async function seedAuditRow(overrides: Partial<typeof auditLog.$inferInsert> = {}) {
  const [row] = await db
    .insert(auditLog)
    .values({
      actorUserId: 'test-admin',
      action: 'test.action',
      entityType: 'test',
      ...overrides
    })
    .returning();
  return row;
}

export async function seedDepartment(overrides: Partial<typeof departments.$inferInsert> = {}) {
  const [dept] = await db
    .insert(departments)
    .values({ name: 'Engineering', code: 'ENG', ...overrides })
    .returning();
  return dept;
}

export async function seedDesignation(
  departmentId: number,
  overrides: Partial<typeof designations.$inferInsert> = {}
) {
  const [desig] = await db
    .insert(designations)
    .values({ name: 'Developer', code: 'DEV', department_id: departmentId, ...overrides })
    .returning();
  return desig;
}

export async function seedLocation(overrides: Partial<typeof locations.$inferInsert> = {}) {
  const [loc] = await db
    .insert(locations)
    .values({
      name: 'Main Office',
      latitude: 40.7128,
      longitude: -74.006,
      radius: 100,
      ...overrides
    })
    .returning();
  return loc;
}

export async function seedShift(overrides: Partial<typeof shifts.$inferInsert> = {}) {
  const [s] = await db
    .insert(shifts)
    .values({ name: 'Morning', start_time: '09:00', end_time: '17:00', ...overrides })
    .returning();
  return s;
}

let taskCreatorSeq = 0;
let employeeSeq = 0;

export async function seedEmployee(
  userId: string,
  overrides: Partial<typeof employees.$inferInsert> = {}
) {
  await seedUser(userId);
  const dept = await seedDepartment({ code: `EMP-DEPT-${++employeeSeq}` });
  const desig = await seedDesignation(dept.id, { code: `EMP-DSG-${employeeSeq}` });
  const loc = await seedLocation();
  const [employee] = await db
    .insert(employees)
    .values({
      id: userId,
      employee_code: `EMP-${userId}`,
      full_name: 'Test Employee',
      email: `${userId}@test.com`,
      birth_date: '1990-01-01',
      department_id: dept.id,
      designation_id: desig.id,
      location_id: loc.id,
      join_date: '2024-01-01',
      ...overrides
    })
    .returning();
  return { employee, department: dept, designation: desig, location: loc };
}

export async function seedCustomer(overrides: Partial<typeof customers.$inferInsert> = {}) {
  const id = overrides.id ?? `cust-${++taskCreatorSeq}`;
  await seedUser(id);
  const [customer] = await db
    .insert(customers)
    .values({
      id,
      customer_code: `CUST-${taskCreatorSeq}`,
      full_name: 'Test Customer',
      email: `${id}@test.com`,
      phone: '08120000000',
      created_by: id,
      ...overrides
    })
    .returning();
  return customer;
}

export async function seedTicket(overrides: Partial<typeof tickets.$inferInsert> = {}) {
  const { created_by, ...rest } = overrides;
  let createdBy = created_by;
  if (!createdBy || createdBy === 'seed') {
    createdBy = `ticket-creator-${++taskCreatorSeq}`;
    await seedUser(createdBy, { role: 'admin' });
  }
  const [ticket] = await db
    .insert(tickets)
    .values({
      title: 'Test Ticket',
      description: '',
      status: 'open',
      priority: 'medium',
      created_by: createdBy,
      ...rest
    })
    .returning();
  return ticket;
}

export async function seedTicketLeg(
  ticketId: number,
  overrides: Partial<typeof ticketLegs.$inferInsert> = {}
) {
  const { ...rest } = overrides;
  const [maxLeg] = await db
    .select({ max: max(ticketLegs.leg_number) })
    .from(ticketLegs)
    .where(eq(ticketLegs.ticket_id, ticketId))
    .limit(1);
  const [leg] = await db
    .insert(ticketLegs)
    .values({
      ticket_id: ticketId,
      leg_number: (maxLeg?.max ?? 0) + 1,
      name: 'Test Leg',
      ...rest
    })
    .returning();
  return leg;
}

export async function seedTicketRequirement(
  ticketId: number,
  overrides: Partial<typeof taskRequirements.$inferInsert> = {}
) {
  const [req] = await db
    .insert(taskRequirements)
    .values({ task_id: ticketId, ...overrides })
    .returning();
  return req;
}

export async function seedTicketMaterial(
  legId: number,
  overrides: Partial<typeof ticketMaterials.$inferInsert> = {}
) {
  const [material] = await db
    .insert(ticketMaterials)
    .values({ leg_id: legId, material_name: 'Test Material', ...overrides })
    .returning();
  return material;
}

export async function seedEmployeeSkill(userId: string, skill: string) {
  await db.insert(employeeSkills).values({ user_id: userId, skill });
}

export async function seedShiftWeekdayRule(
  shiftId: number,
  overrides: Partial<typeof shiftWeekdayRules.$inferInsert> = {}
) {
  const [rule] = await db
    .insert(shiftWeekdayRules)
    .values({
      shift_id: shiftId,
      day_of_week: 1, // Monday
      is_working_day: true,
      start_time: '09:00',
      end_time: '17:00',
      late_tolerance_minutes: 0,
      absence_cutoff_minutes: 120,
      ...overrides
    })
    .returning();
  return rule;
}

export async function seedScheduleAssignment(
  overrides: Partial<typeof scheduleAssignments.$inferInsert> = {}
) {
  const [assignment] = await db
    .insert(scheduleAssignments)
    .values({
      user_id: 'test-user-att-123',
      shift_id: 1,
      effective_from: '2026-01-01',
      effective_to: null,
      ...overrides
    })
    .returning();
  return assignment;
}

export async function seedDateOverride(overrides: Partial<typeof dateOverrides.$inferInsert> = {}) {
  const [override] = await db
    .insert(dateOverrides)
    .values({
      user_id: 'test-user-att-123',
      date: '2026-08-04',
      shift_id: 1,
      ...overrides
    })
    .returning();
  return override;
}

export async function seedDayOff(overrides: Partial<typeof dayOffs.$inferInsert> = {}) {
  const [dayOff] = await db
    .insert(dayOffs)
    .values({
      user_id: 'test-user-att-123',
      date: '2026-08-04',
      ...overrides
    })
    .returning();
  return dayOff;
}

export async function seedAttendanceCorrection(
  overrides: Partial<typeof attendanceCorrections.$inferInsert> = {}
) {
  const [correction] = await db
    .insert(attendanceCorrections)
    .values({
      attendance_id: 1,
      actor_id: 'test-admin',
      reason: 'Manual correction',
      ...overrides
    })
    .returning();
  return correction;
}
