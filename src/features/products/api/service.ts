// ============================================================
// Product Service — Server-function wrappers
// ============================================================
// These wrappers expose the server-only data access (PostgreSQL via
// Drizzle) as TanStack Start server functions. The actual DB module is
// imported dynamically inside each handler, so the `postgres` driver is
// never bundled into the client. Every endpoint enforces a valid session
// and validates its input at the RPC boundary (not just at the route
// level) so it cannot be reached unauthenticated or with malformed input.

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { withAudit } from '@/lib/audit';
import { requireRole } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withRequestContext } from '@/lib/request-id';
import { productFiltersSchema, productIdSchema, productMutationSchema } from './validation';

export const getProductsFn = createServerFn({ method: 'GET' })
  .validator(productFiltersSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      await requireRole('user');
      const { getProducts } = await import('@/lib/db/products');
      return getProducts(data);
    })
  );

export const getProductByIdFn = createServerFn({ method: 'GET' })
  .validator(productIdSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      await requireRole('user');
      const { getProductById } = await import('@/lib/db/products');
      return getProductById(id);
    })
  );

export const createProductFn = createServerFn({ method: 'POST' })
  .validator(productMutationSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      await checkRateLimit(`write:${session.user.id}`);
      const { createProduct } = await import('@/lib/db/products');
      const created = await createProduct(data);
      await withAudit(
        session.user.id,
        {
          action: 'product.create',
          entityType: 'product',
          entityId: created.product.id,
          before: null,
          after: created
        },
        async () => undefined
      );
      return created;
    })
  );

export const updateProductFn = createServerFn({ method: 'POST' })
  .validator(
    zodValidator(
      z.object({
        id: productIdSchema,
        values: productMutationSchema
      })
    )
  )
  .handler(async ({ data: { id, values } }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      await checkRateLimit(`write:${session.user.id}`);
      const { updateProduct, getProductById } = await import('@/lib/db/products');
      const before = await getProductById(id);
      const updated = await updateProduct(id, values);
      await withAudit(
        session.user.id,
        {
          action: 'product.update',
          entityType: 'product',
          entityId: id,
          before,
          after: updated
        },
        async () => undefined
      );
      return updated;
    })
  );

export const deleteProductFn = createServerFn({ method: 'POST' })
  .validator(productIdSchema)
  .handler(async ({ data: id }) =>
    withRequestContext(async () => {
      const session = await requireRole('admin');
      await checkRateLimit(`write:${session.user.id}`);
      const { deleteProduct, getProductById } = await import('@/lib/db/products');
      const before = await getProductById(id);
      const deleted = await deleteProduct(id);
      await withAudit(
        session.user.id,
        {
          action: 'product.delete',
          entityType: 'product',
          entityId: id,
          before,
          after: null
        },
        async () => undefined
      );
      return deleted;
    })
  );
