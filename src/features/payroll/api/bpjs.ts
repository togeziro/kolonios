import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { employeeBpjsFamilyMembers } from '@/lib/db/schema/payroll';
import {
  listEmployeeBpjsEnrollments,
  listEmployeeBpjsFamilyMembers,
  upsertEmployeeBpjsEnrollment,
  withPayrollAuditTransaction
} from '@/lib/db/payroll';
import { assertEmployeeScope, sanitizePayrollProfileForActor } from './shared';
import {
  bpjsEnrollmentSchema,
  bpjsFamilyMemberIdSchema,
  bpjsFamilyMemberSchema,
  employeePayrollProfileReadSchema
} from './validation';

export const listEmployeeBpjsEnrollmentsFn = createServerFn({ method: 'GET' })
  .validator(employeePayrollProfileReadSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    assertEmployeeScope(session, data.employeeId);
    const enrollments = await listEmployeeBpjsEnrollments(data.employeeId);
    const withFamily = await Promise.all(
      enrollments.map(async (enrollment) => ({
        ...enrollment,
        familyMembers: await listEmployeeBpjsFamilyMembers(enrollment.id)
      }))
    );
    return JSON.parse(
      JSON.stringify(sanitizePayrollProfileForActor(session, { enrollments: withFamily }))
    );
  });

export const upsertEmployeeBpjsEnrollmentFn = createServerFn({ method: 'POST' })
  .validator(bpjsEnrollmentSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    assertEmployeeScope(session, data.employeeId);
    return withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.bpjs_enrollment.upsert',
        entityType: 'employee_bpjs_enrollment',
        entityId: data.employeeId
      },
      async (tx) =>
        upsertEmployeeBpjsEnrollment(
          {
            employee_id: data.employeeId,
            program: data.program,
            membership_number: data.membershipNumber ?? '',
            registration_date: data.registrationDate ?? null,
            registered_wage: data.registeredWage,
            jkk_category_override: data.jkkCategoryOverride ?? null,
            is_active: data.isActive,
            effective_from: data.effectiveFrom,
            effective_to: data.effectiveTo ?? null
          },
          tx
        )
    );
  });

export const createEmployeeBpjsFamilyMemberFn = createServerFn({ method: 'POST' })
  .validator(bpjsFamilyMemberSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.bpjs_family_member.create',
        entityType: 'employee_bpjs_family_member'
      },
      async (tx) => {
        const [created] = await tx
          .insert(employeeBpjsFamilyMembers)
          .values({
            enrollment_id: data.enrollmentId,
            name: data.name,
            relationship: data.relationship,
            birth_date: data.birthDate ?? null,
            is_core: data.isCore
          })
          .returning();
        if (!created) throw new DomainError('Failed to create BPJS family member.');
        return created;
      }
    );
  });

export const deleteEmployeeBpjsFamilyMemberFn = createServerFn({ method: 'POST' })
  .validator(bpjsFamilyMemberIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.bpjs_family_member.delete',
        entityType: 'employee_bpjs_family_member',
        entityId: data.id
      },
      async (tx) =>
        (
          await tx
            .delete(employeeBpjsFamilyMembers)
            .where(eq(employeeBpjsFamilyMembers.id, data.id))
            .returning()
        ).length > 0
    );
  });
