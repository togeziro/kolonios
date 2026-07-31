import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requireRole } from '@/lib/auth/session';
import { withRequestContext } from '@/lib/request-id';
import { withAudit } from '@/lib/audit';
import { customerFiltersSchema, customerIdSchema, customerMutationSchema } from './validation';

export const listCustomersFn = createServerFn({ method: 'GET' })
  .validator(customerFiltersSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      await requireRole('user');
      const { listCustomers } = await import('@/lib/db/customers');
      return listCustomers(data);
    })
  );

export const getCustomerByIdFn = createServerFn({ method: 'GET' })
  .validator(customerIdSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      await requireRole('user');
      const { getCustomerById } = await import('@/lib/db/customers');
      return getCustomerById(id);
    })
  );

export const createCustomerFn = createServerFn({ method: 'POST' })
  .validator(customerMutationSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      const { createCustomer } = await import('@/lib/db/customers');
      const created = await createCustomer({ ...data, created_by: session.user.id });
      await withAudit(
        session.user.id,
        {
          action: 'customer.create',
          entityType: 'customer',
          entityId: created.customer.id,
          before: null,
          after: created
        },
        async () => undefined
      );
      return created;
    })
  );

export const updateCustomerFn = createServerFn({ method: 'POST' })
  .validator(
    zodValidator(
      z.object({
        id: customerIdSchema,
        values: customerMutationSchema
      })
    )
  )
  .handler(async ({ data: { id, values } }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      const { updateCustomer, getCustomerById } = await import('@/lib/db/customers');
      const before = await getCustomerById(id);
      const updated = await updateCustomer(id, values);
      await withAudit(
        session.user.id,
        {
          action: 'customer.update',
          entityType: 'customer',
          entityId: id,
          before,
          after: updated
        },
        async () => undefined
      );
      return updated;
    })
  );

export const deleteCustomerFn = createServerFn({ method: 'POST' })
  .validator(customerIdSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      const { deleteCustomer, getCustomerById } = await import('@/lib/db/customers');
      const before = await getCustomerById(id);
      const deleted = await deleteCustomer(id);
      await withAudit(
        session.user.id,
        {
          action: 'customer.delete',
          entityType: 'customer',
          entityId: id,
          before,
          after: null
        },
        async () => undefined
      );
      return deleted;
    })
  );
