import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withAudit } from '@/lib/audit';
import { businessDateInTimeZone } from '@/lib/dates';
import { employeeFiltersSchema, employeeIdSchema, employeeMutationSchema } from './validation';
import { onboardEmployeeSchema } from './validation';

export const listEmployeesFn = createServerFn({ method: 'GET' })
  .validator(employeeFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('employees', 'view');
    const { listEmployees } = await import('@/lib/db/employees');
    return listEmployees(data);
  });

export const getEmployeeByIdFn = createServerFn({ method: 'GET' })
  .validator(employeeIdSchema)
  .handler(async ({ data: id }) => {
    await requirePermission('employees', 'view');
    const { getEmployeeById } = await import('@/lib/db/employees');
    return getEmployeeById(id);
  });

export const createEmployeeFn = createServerFn({ method: 'POST' })
  .validator(employeeMutationSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('employees', 'add');
    await checkRateLimit(`write:${session.user.id}`);
    const { createEmployee } = await import('@/lib/db/employees');
    try {
      const created = await createEmployee({ ...data, created_by: session.user.id });
      await withAudit(
        session.user.id,
        {
          action: 'employee.create',
          entityType: 'employee',
          entityId: created.employee.id,
          before: null,
          after: created
        },
        async () => undefined
      );
      return created;
    } catch (error) {
      // Mirror createUserFn: a throw here means no employee survives, but the
      // ATTEMPT itself must stay visible — record a create_failed trail keyed
      // by email, otherwise failed provisioning leaves zero trace (the exact
      // gap hit in prod). DomainErrors like EMPLOYEE_ALREADY_LINKED propagate
      // as-is; we only enrich the audit trail here, never wrap.
      const { getErrorMessage } = await import('@/lib/errors');
      const { insertAuditRow } = await import('@/lib/db/audit');
      const { getRequestId } = await import('@/lib/request-id.server');
      await insertAuditRow({
        actorUserId: session.user.id,
        action: 'employee.create_failed',
        entityType: 'employee',
        entityId: data.email,
        before: null,
        after: { email: data.email, name: data.full_name, error: getErrorMessage(error) },
        requestId: getRequestId() ?? null
      });
      throw error;
    }
  });

/**
 * Single-action onboarding (account + HR profile, never Pending). Guarded
 * by `employees.add` only: user provisioning is an implementation detail of
 * the employee act, same as createEmployee — requiring `users.add` as well
 * would lock HR (who holds employees.add but only users.view) out of
 * onboarding their own hires.
 */
export const onboardEmployeeFn = createServerFn({ method: 'POST' })
  .validator(onboardEmployeeSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('employees', 'add');
    await checkRateLimit(`write:${session.user.id}`);
    const { onboardEmployee } = await import('@/lib/db/employees');
    try {
      const onboarded = await onboardEmployee({ ...data, created_by: session.user.id });
      const { generatedPassword: _secret, ...auditable } = onboarded;
      await withAudit(
        session.user.id,
        {
          action: 'employee.onboard',
          entityType: 'employee',
          entityId: onboarded.employee.id,
          before: null,
          // The one-time credential must never touch the audit trail — it
          // lives only in the onboard response + the admin's copy dialog.
          after: auditable
        },
        async () => undefined
      );
      return onboarded;
    } catch (error) {
      const { getErrorMessage } = await import('@/lib/errors');
      const { insertAuditRow } = await import('@/lib/db/audit');
      const { getRequestId } = await import('@/lib/request-id.server');
      await insertAuditRow({
        actorUserId: session.user.id,
        action: 'employee.onboard_failed',
        entityType: 'employee',
        entityId: data.email,
        before: null,
        after: { email: data.email, name: data.full_name, error: getErrorMessage(error) },
        requestId: getRequestId() ?? null
      });
      throw error;
    }
  });

export const updateEmployeeFn = createServerFn({ method: 'POST' })
  .validator(
    zodValidator(
      z.object({
        id: employeeIdSchema,
        values: employeeMutationSchema
      })
    )
  )
  .handler(async ({ data: { id, values } }) => {
    const session = await requirePermission('employees', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateEmployee, getEmployeeById } = await import('@/lib/db/employees');
    const before = await getEmployeeById(id);
    const updated = await updateEmployee(id, values, {
      actorUserId: session.user.id,
      effectiveDate: businessDateInTimeZone(new Date())
    });
    await withAudit(
      session.user.id,
      {
        action: 'employee.update',
        entityType: 'employee',
        entityId: id,
        before,
        after: updated
      },
      async () => undefined
    );
    return updated;
  });

export const deleteEmployeeFn = createServerFn({ method: 'POST' })
  .validator(employeeIdSchema)
  .handler(async ({ data: id }) => {
    const session = await requirePermission('employees', 'delete');
    await checkRateLimit(`write:${session.user.id}`);
    const { deleteEmployee, getEmployeeById } = await import('@/lib/db/employees');
    const before = await getEmployeeById(id);
    const deleted = await deleteEmployee(id);
    await withAudit(
      session.user.id,
      {
        action: 'employee.delete',
        entityType: 'employee',
        entityId: id,
        before,
        after: null
      },
      async () => undefined
    );
    return deleted;
  });
