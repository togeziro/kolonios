import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requireRole } from '@/lib/auth/session';
import { customerFiltersSchema, customerIdSchema, customerMutationSchema } from './validation';

export const listCustomersFn = createServerFn({ method: 'GET' })
  .validator(customerFiltersSchema)
  .handler(async ({ data }) => {
    await requireRole('user');
    const { listCustomers } = await import('@/lib/db/customers');
    return listCustomers(data);
  });

export const getCustomerByIdFn = createServerFn({ method: 'GET' })
  .validator(customerIdSchema)
  .handler(async ({ data: id }) => {
    await requireRole('user');
    const { getCustomerById } = await import('@/lib/db/customers');
    return getCustomerById(id);
  });

export const createCustomerFn = createServerFn({ method: 'POST' })
  .validator(customerMutationSchema)
  .handler(async ({ data }) => {
    await requireRole('admin');
    const { createCustomer } = await import('@/lib/db/customers');
    const { requireSession } = await import('@/lib/auth/session');
    const session = await requireSession();
    return createCustomer({ ...data, created_by: session.user.id });
  });

export const updateCustomerFn = createServerFn({ method: 'POST' })
  .validator(
    zodValidator(
      z.object({
        id: customerIdSchema,
        values: customerMutationSchema
      })
    )
  )
  .handler(async ({ data: { id, values } }) => {
    await requireRole('admin');
    const { updateCustomer } = await import('@/lib/db/customers');
    return updateCustomer(id, values);
  });

export const deleteCustomerFn = createServerFn({ method: 'POST' })
  .validator(customerIdSchema)
  .handler(async ({ data: id }) => {
    await requireRole('admin');
    const { deleteCustomer } = await import('@/lib/db/customers');
    return deleteCustomer(id);
  });
