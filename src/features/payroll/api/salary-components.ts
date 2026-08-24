import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { salaryComponents } from '@/lib/db/schema/payroll';
import { listSalaryComponents, withPayrollAuditTransaction } from '@/lib/db/payroll';
import {
  salaryComponentIdSchema,
  salaryComponentSchema,
  salaryComponentUpdateSchema
} from './validation';

export const listSalaryComponentsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('payroll', 'view');
  return listSalaryComponents();
});

export const createSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'add');
    const created = await withPayrollAuditTransaction(
      session.user.id,
      { action: 'payroll.salary_component.create', entityType: 'salary_component' },
      async (tx) => {
        const [row] = await tx
          .insert(salaryComponents)
          .values({
            code: data.code,
            name: data.name,
            type: data.type,
            description: data.description ?? null,
            is_active: data.isActive
          })
          .returning();
        if (!row)
          throw new DomainError(
            'Failed to create salary component.',
            'PAYROLL_COMPONENT_CREATE_FAILED'
          );
        return row;
      }
    );
    return created;
  });

export const updateSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentUpdateSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    const updated = await withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.salary_component.update',
        entityType: 'salary_component',
        entityId: data.id
      },
      async (tx) => {
        const [row] = await tx
          .update(salaryComponents)
          .set({
            code: data.values.code,
            name: data.values.name,
            type: data.values.type,
            description: data.values.description,
            is_active: data.values.isActive,
            updated_at: new Date()
          })
          .where(eq(salaryComponents.id, data.id))
          .returning();
        if (!row)
          throw new DomainError('Salary component was not found.', 'PAYROLL_COMPONENT_NOT_FOUND');
        return row;
      }
    );
    return updated;
  });

export const deleteSalaryComponentFn = createServerFn({ method: 'POST' })
  .validator(salaryComponentIdSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'delete');
    const deleted = await withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.salary_component.delete',
        entityType: 'salary_component',
        entityId: data.id
      },
      async (tx) =>
        (await tx.delete(salaryComponents).where(eq(salaryComponents.id, data.id)).returning())
          .length > 0
    );
    return deleted;
  });
