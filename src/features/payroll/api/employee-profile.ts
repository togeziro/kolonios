import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, gte, ne, or, sql } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { db } from '@/lib/db';
import {
  employeeBankAccounts,
  employeeBenefitEnrollments,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  employeeTaxRecords,
  payrollPeriods,
  payrollRecords,
  salaryComponents
} from '@/lib/db/schema/payroll';
import {
  getEmploymentContext,
  listEmployeePayrollProfileHistory,
  resolveEffectiveRecord,
  withPayrollAuditTransaction
} from '@/lib/db/payroll';
import {
  assertEmployeeScope,
  assertProfileReferenceScope,
  mapSalaryComponent,
  sanitizePayrollProfileForActor
} from './shared';
import { upsertVersionedRecord } from './versioned-record';
import { employeePayrollProfileReadSchema, employeePayrollProfileSchema } from './validation';

export const getEmployeePayrollProfileFn = createServerFn({ method: 'GET' })
  .validator(employeePayrollProfileReadSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'view');
    assertEmployeeScope(session, data.employeeId);
    const asOfDate = new Date().toISOString().slice(0, 10);
    const [employment, history, taxRecords, paymentHistory] = await Promise.all([
      getEmploymentContext(data.employeeId, asOfDate),
      listEmployeePayrollProfileHistory(data.employeeId),
      db
        .select()
        .from(employeeTaxRecords)
        .where(eq(employeeTaxRecords.employee_id, data.employeeId))
        .orderBy(desc(employeeTaxRecords.tax_period)),
      db
        .select({
          id: payrollRecords.id,
          period_name: payrollPeriods.name,
          period_start: payrollPeriods.period_start,
          period_end: payrollPeriods.period_end,
          payment_date: payrollPeriods.payment_date,
          net_salary: payrollRecords.net_salary,
          period_status: payrollPeriods.status
        })
        .from(payrollRecords)
        .innerJoin(payrollPeriods, eq(payrollRecords.payroll_period_id, payrollPeriods.id))
        .where(
          and(eq(payrollRecords.employee_id, data.employeeId), ne(payrollPeriods.status, 'draft'))
        )
        .orderBy(desc(payrollPeriods.period_start))
    ]);
    const assignment = history?.assignments
      ? resolveEffectiveRecord(data.employeeId, asOfDate, history.assignments)
      : null;
    const tax = history?.taxProfiles
      ? resolveEffectiveRecord(data.employeeId, asOfDate, history.taxProfiles)
      : null;
    const bank = history?.bankAccounts
      ? resolveEffectiveRecord(
          data.employeeId,
          asOfDate,
          history.bankAccounts.filter((account) => account.is_primary)
        )
      : null;
    return JSON.parse(
      JSON.stringify(
        sanitizePayrollProfileForActor(session, {
          employment,
          assignment,
          components: (history?.components ?? []).map(({ component, definition }) => ({
            component,
            definition,
            input: mapSalaryComponent(component, definition, component.salary_component_id)
          })),
          assignments: history?.assignments ?? [],
          tax,
          taxProfiles: history?.taxProfiles ?? [],
          benefits: history?.benefits ?? [],
          bank,
          bankAccounts: history?.bankAccounts ?? [],
          taxRecords,
          paymentHistory
        })
      )
    );
  });

export const updateEmployeePayrollProfileFn = createServerFn({ method: 'POST' })
  .validator(employeePayrollProfileSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    assertEmployeeScope(session, data.employeeId);
    const result = await withPayrollAuditTransaction(
      session.user.id,
      {
        action: `payroll.profile.${data.kind}.update`,
        entityType: 'employee_payroll_profile',
        entityId: data.employeeId
      },
      async (tx) => {
        if (data.kind === 'assignment') {
          const values = {
            employee_id: data.employeeId,
            salary_type: data.values.salaryType,
            amount: data.values.amount,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null,
            department_id: data.values.departmentId ?? null,
            designation_id: data.values.designationId ?? null,
            created_by: session.user.id
          };
          return upsertVersionedRecord({
            tx,
            table: employeeSalaryAssignments,
            values,
            effectiveFrom: data.values.effectiveFrom,
            id: data.values.id,
            identityWhere: eq(employeeSalaryAssignments.employee_id, data.employeeId),
            existingWhere: and(
              eq(employeeSalaryAssignments.id, data.values.id ?? -1),
              eq(employeeSalaryAssignments.employee_id, data.employeeId)
            ),
            errors: {
              notFound: ['Salary assignment was not found.', 'PAYROLL_ASSIGNMENT_NOT_FOUND'],
              versionFailed: [
                'Failed to create salary assignment version.',
                'PAYROLL_ASSIGNMENT_VERSION_FAILED'
              ],
              createFailed: [
                'Failed to create salary assignment.',
                'PAYROLL_ASSIGNMENT_CREATE_FAILED'
              ]
            }
          });
        }
        if (data.kind === 'component') {
          const [assignment] = await tx
            .select({ employee_id: employeeSalaryAssignments.employee_id })
            .from(employeeSalaryAssignments)
            .where(eq(employeeSalaryAssignments.id, data.values.assignmentId))
            .limit(1);
          if (!assignment)
            throw new DomainError(
              'Salary assignment was not found.',
              'PAYROLL_ASSIGNMENT_NOT_FOUND'
            );
          assertProfileReferenceScope(session, data.employeeId, assignment.employee_id);
          const [definition] = await tx
            .select({ id: salaryComponents.id })
            .from(salaryComponents)
            .where(eq(salaryComponents.id, data.values.salaryComponentId))
            .limit(1);
          if (!definition)
            throw new DomainError('Salary component was not found.', 'PAYROLL_COMPONENT_NOT_FOUND');
          const values = {
            assignment_id: data.values.assignmentId,
            salary_component_id: data.values.salaryComponentId,
            amount: data.values.amount,
            mode: data.values.mode,
            percentage_base: data.values.percentageBase ?? null,
            attendance_metric: data.values.attendanceMetric ?? null,
            taxable: data.values.taxable,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null
          };
          return upsertVersionedRecord({
            tx,
            table: employeeSalaryComponents,
            values,
            effectiveFrom: data.values.effectiveFrom,
            id: data.values.id,
            identityWhere: and(
              eq(employeeSalaryComponents.assignment_id, data.values.assignmentId),
              eq(employeeSalaryComponents.salary_component_id, data.values.salaryComponentId)
            ),
            existingWhere: eq(employeeSalaryComponents.id, data.values.id ?? -1),
            updateGuards: (existing) => {
              if (
                existing.assignment_id !== data.values.assignmentId ||
                existing.salary_component_id !== data.values.salaryComponentId
              ) {
                throw new DomainError('Salary component identity is immutable.', 'IMMUTABLE_FIELD');
              }
            },
            errors: {
              notFound: ['Employee salary component was not found.', 'PAYROLL_COMPONENT_NOT_FOUND'],
              versionFailed: [
                'Failed to create employee salary component version.',
                'PAYROLL_COMPONENT_VERSION_FAILED'
              ],
              createFailed: [
                'Failed to create employee salary component.',
                'PAYROLL_COMPONENT_CREATE_FAILED'
              ]
            }
          });
        }
        if (data.kind === 'tax') {
          const values = {
            employee_id: data.employeeId,
            tax_setting_id: data.values.taxSettingId ?? null,
            tax_identifier: data.values.taxIdentifier ?? null,
            filing_status: data.values.filingStatus ?? null,
            employment_status: data.values.employmentStatus ?? undefined,
            ptkp_status: data.values.ptkpStatus ?? undefined,
            residency: data.values.residency ?? undefined,
            tax_facility: data.values.taxFacility ?? undefined,
            tax_object_code: data.values.taxObjectCode ?? undefined,
            pph21_method: data.values.pph21Method ?? null,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null
          };
          return upsertVersionedRecord({
            tx,
            table: employeeTaxProfiles,
            values,
            effectiveFrom: data.values.effectiveFrom,
            id: data.values.id,
            identityWhere: eq(employeeTaxProfiles.employee_id, data.employeeId),
            existingWhere: and(
              eq(employeeTaxProfiles.id, data.values.id ?? -1),
              eq(employeeTaxProfiles.employee_id, data.employeeId)
            ),
            errors: {
              notFound: ['Tax profile was not found.', 'TAX_PROFILE_NOT_FOUND'],
              versionFailed: [
                'Failed to create tax profile version.',
                'TAX_PROFILE_VERSION_FAILED'
              ],
              createFailed: ['Failed to create tax profile.', 'TAX_PROFILE_CREATE_FAILED']
            }
          });
        }
        if (data.kind === 'benefit') {
          const values = {
            employee_id: data.employeeId,
            benefit_code: data.values.benefitCode,
            benefit_name: data.values.benefitName,
            amount: data.values.amount ?? null,
            effective_from: data.values.effectiveFrom,
            effective_to: data.values.effectiveTo ?? null,
            status: data.values.status
          };
          return upsertVersionedRecord({
            tx,
            table: employeeBenefitEnrollments,
            values,
            effectiveFrom: data.values.effectiveFrom,
            id: data.values.id,
            identityWhere: eq(employeeBenefitEnrollments.employee_id, data.employeeId),
            existingWhere: and(
              eq(employeeBenefitEnrollments.id, data.values.id ?? -1),
              eq(employeeBenefitEnrollments.employee_id, data.employeeId)
            ),
            errors: {
              notFound: ['Benefit enrollment was not found.', 'BENEFIT_NOT_FOUND'],
              versionFailed: [
                'Failed to create benefit enrollment version.',
                'BENEFIT_VERSION_FAILED'
              ],
              createFailed: ['Failed to create benefit enrollment.', 'BENEFIT_CREATE_FAILED']
            }
          });
        }
        const values = {
          employee_id: data.employeeId,
          bank_name: data.values.bankName,
          account_name: data.values.accountName,
          account_number: data.values.accountNumber,
          is_primary: data.values.isPrimary,
          effective_from: data.values.effectiveFrom,
          effective_to: data.values.effectiveTo ?? null
        };
        const primaryGuard = async () => {
          if (!values.is_primary) return;
          const activePrimary = await tx
            .select()
            .from(employeeBankAccounts)
            .where(
              and(
                eq(employeeBankAccounts.employee_id, data.employeeId),
                eq(employeeBankAccounts.is_primary, true),
                ...(data.values.id ? [ne(employeeBankAccounts.id, data.values.id)] : []),
                or(
                  sql`${employeeBankAccounts.effective_to} is null`,
                  gte(employeeBankAccounts.effective_to, values.effective_from)
                )
              )
            )
            .limit(1);
          if (activePrimary.length > 0)
            throw new DomainError(
              'A primary bank account already exists for this employee.',
              'DUPLICATE_PRIMARY_BANK_ACCOUNT'
            );
        };
        return upsertVersionedRecord({
          tx,
          table: employeeBankAccounts,
          values,
          effectiveFrom: data.values.effectiveFrom,
          id: data.values.id,
          identityWhere: eq(employeeBankAccounts.employee_id, data.employeeId),
          existingWhere: and(
            eq(employeeBankAccounts.id, data.values.id ?? -1),
            eq(employeeBankAccounts.employee_id, data.employeeId)
          ),
          updateGuards: async (existing) => {
            await primaryGuard();
            values.account_number = values.account_number || existing.account_number;
          },
          createGuards: primaryGuard,
          errors: {
            notFound: ['Bank account was not found.', 'BANK_ACCOUNT_NOT_FOUND'],
            versionFailed: [
              'Failed to create bank account version.',
              'BANK_ACCOUNT_VERSION_FAILED'
            ],
            createFailed: ['Failed to create bank account.', 'BANK_ACCOUNT_CREATE_FAILED']
          }
        });
      }
    );
    return JSON.parse(JSON.stringify(result));
  });
