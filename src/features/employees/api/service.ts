import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requireRole } from '@/lib/auth/session';
import { withRequestContext } from '@/lib/request-id';
import { withAudit } from '@/lib/audit';
import { employeeFiltersSchema, employeeIdSchema, employeeMutationSchema } from './validation';

export const listEmployeesFn = createServerFn({ method: 'GET' })
  .validator(employeeFiltersSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      await requireRole('user');
      const { listEmployees } = await import('@/lib/db/employees');
      return listEmployees(data);
    })
  );

export const getEmployeeByIdFn = createServerFn({ method: 'GET' })
  .validator(employeeIdSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      await requireRole('user');
      const { getEmployeeById } = await import('@/lib/db/employees');
      return getEmployeeById(id);
    })
  );

export const createEmployeeFn = createServerFn({ method: 'POST' })
  .validator(employeeMutationSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('hr');
      const { createEmployee } = await import('@/lib/db/employees');
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
    })
  );

export const updateEmployeeFn = createServerFn({ method: 'POST' })
  .validator(
    zodValidator(
      z.object({
        id: employeeIdSchema,
        values: employeeMutationSchema
      })
    )
  )
  .handler(async ({ data: { id, values } }) =>
    withRequestContext(async () => {
      const session = await requireRole('hr');
      const { updateEmployee, getEmployeeById } = await import('@/lib/db/employees');
      const before = await getEmployeeById(id);
      const updated = await updateEmployee(id, values);
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
    })
  );

export const deleteEmployeeFn = createServerFn({ method: 'POST' })
  .validator(employeeIdSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      const session = await requireRole('hr');
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
    })
  );
