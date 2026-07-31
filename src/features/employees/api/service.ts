import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requireRole } from '@/lib/auth/session';
import { withRequestContext } from '@/lib/request-id';
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
      await requireRole('hr');
      const { createEmployee } = await import('@/lib/db/employees');
      const { requireSession } = await import('@/lib/auth/session');
      const session = await requireSession();
      return createEmployee({ ...data, created_by: session.user.id });
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
      await requireRole('hr');
      const { updateEmployee } = await import('@/lib/db/employees');
      return updateEmployee(id, values);
    })
  );

export const deleteEmployeeFn = createServerFn({ method: 'POST' })
  .validator(employeeIdSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      await requireRole('hr');
      const { deleteEmployee } = await import('@/lib/db/employees');
      return deleteEmployee(id);
    })
  );
