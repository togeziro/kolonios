# CRUD Standardization Guide

This guide explains the standardized CRUD pattern used in the Kolonios project. All new features should follow this pattern to ensure consistency, maintainability, and type safety.

## Reference Implementation

The **products feature** (`src/features/products/`) serves as the canonical reference implementation. When in doubt, check the products feature first.

## Standard File Structure

Every feature module should follow this 5-file structure:

```
src/features/your-feature/
├── api/
│   ├── types.ts          # TypeScript types
│   ├── validation.ts     # Zod schemas
│   ├── queries.ts        # Query keys and query options
│   ├── mutations.ts      # Mutation options
│   └── service.ts        # Server functions (RPC endpoints)
├── components/           # UI components
├── schemas/              # Form schemas (if needed)
└── constants/            # Feature-specific constants
```

**Why this structure?**
- Clear separation of concerns
- Easy to locate code
- Scales well as features grow
- Enables tree-shaking and code splitting

## Types Pattern

Define all types in `types.ts`. Use descriptive names that reflect the domain.

```typescript
// src/features/products/api/types.ts

// Main entity type - matches database schema
export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  created_at: string;
  updated_at: string;
};

// Filter/pagination types for list endpoints
export type ProductFilters = {
  page?: number;
  limit?: number;
  categories?: string | string[];
  search?: string;
  sort?: string;
};

// Response types - match server function return types
export type ProductsResponse = {
  success: boolean;
  time: string;
  message: string;
  total_products: number;
  offset: number;
  limit: number;
  products: Product[];
};

export type ProductByIdResponse = {
  success: boolean;
  time: string;
  message: string;
  product: Product;
};

// Mutation payload - what the client sends
export type ProductMutationPayload = {
  name: string;
  category: string;
  price: number;
  description: string;
};
```

**Key principles:**
- Use `type` aliases, not `interface` (easier to merge and export)
- Export all types that other modules need
- Response types should match the actual API response structure
- Payload types should be minimal (only what's needed for the mutation)

## Validation Pattern

Use Zod schemas in `validation.ts` for runtime type safety. These schemas validate data at the RPC boundary.

```typescript
// src/features/products/api/validation.ts
import { z } from 'zod';
import type { ProductFilters, ProductMutationPayload } from './types';

// Coerce types when data comes from URL/search params
export const productFiltersSchema: z.ZodType<ProductFilters> = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  categories: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional()
});

// ID validation - reuse this in multiple places
export const productIdSchema = z.coerce.number().int().positive();

// Mutation payload validation
export const productMutationSchema: z.ZodType<ProductMutationPayload> = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().positive('Price must be positive'),
  description: z.string().min(1, 'Description is required')
});
```

**Why Zod?**
- Runtime validation at RPC boundary
- Type inference (Zod → TypeScript)
- Coercion support (URL params are strings)
- Error messages for user feedback

**Best practices:**
- Use `z.coerce` for URL/search param data
- Export schemas for reuse in forms
- Add validation messages for better UX
- Use `z.ZodType<Type>` for type inference when types already exist

## Query Keys Pattern

Use a structured query key factory in `queries.ts`. This ensures consistency and enables selective invalidation.

```typescript
// src/features/products/api/queries.ts
import { queryOptions } from '@tanstack/react-query';
import { getProductsFn, getProductByIdFn } from './service';
import type { Product, ProductFilters } from './types';

// Re-export types for convenience
export type { Product };

// Query key factory - centralizes key structure
export const productKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => [...productKeys.all, 'list', filters] as const,
  detail: (id: number) => [...productKeys.all, 'detail', id] as const
};

// Query options - pre-configured query configurations
export const productsQueryOptions = (filters: ProductFilters) =>
  queryOptions({
    queryKey: productKeys.list(filters),
    queryFn: () => getProductsFn({ data: filters })
  });

export const productByIdQueryOptions = (id: number) =>
  queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: () => getProductByIdFn({ data: id })
  });
```

**Why query key factories?**
- Type-safe query keys
- Consistent key structure
- Easy invalidation (`invalidateQueries({ queryKey: productKeys.all })`)
- Enables debugging (keys are readable)

**Key structure rules:**
- `all`: Base key for the feature
- `list`: For collection queries (with filters)
- `detail`: For single entity queries (with ID)

## Authorization Pattern

Use `requirePermission()` in server functions to enforce RBAC. Always check permissions at the RPC boundary.

```typescript
// src/features/products/api/service.ts
import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withAudit } from '@/lib/audit';
import { withRequestContext } from '@/lib/request-id';

export const getProductsFn = createServerFn({ method: 'GET' })
  .validator(productFiltersSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      // Always require permission for data access
      await requirePermission('products', 'view');

      const { getProducts } = await import('@/lib/db/products');
      return getProducts(data);
    })
  );

export const createProductFn = createServerFn({ method: 'POST' })
  .validator(productMutationSchema)
  .handler(async ({ data }) =>
    withRequestContext(async () => {
      // Require permission for the specific action
      const session = await requirePermission('products', 'add');

      // Rate limiting for write operations
      await checkRateLimit(`write:${session.user.id}`);

      const { createProduct } = await import('@/lib/db/products');
      const created = await createProduct(data);

      // Audit logging for compliance
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
```

**Permission matrix:**
- `view`: List and get by ID
- `add`: Create new entities
- `edit`: Update existing entities
- `delete`: Remove entities

**Why authorize at RPC boundary?**
- Single point of enforcement
- Cannot be bypassed by client-side routing
- Consistent with server function architecture
- Enables audit logging

## Mutations Pattern

Define mutation options in `mutations.ts` with proper cache invalidation.

```typescript
// src/features/products/api/mutations.ts
import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createProductFn, updateProductFn, deleteProductFn } from './service';
import { productKeys } from './queries';
import type { ProductMutationPayload } from './types';

export const createProductMutation = mutationOptions({
  mutationFn: (data: ProductMutationPayload) => createProductFn({ data }),
  onSuccess: () => {
    // Invalidate all product queries to refetch lists and details
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  }
});

export const updateProductMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: number; values: ProductMutationPayload }) =>
    updateProductFn({ data: { id, values } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  }
});

export const deleteProductMutation = mutationOptions({
  mutationFn: (id: number) => deleteProductFn({ data: id }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  }
});
```

**Why centralized mutations?**
- Reusable across components
- Consistent invalidation strategy
- Type-safe mutation payloads
- Easy to add global error handling

** Invalidation strategy:**
- Invalidate `all` keys for simple cases
- Invalidate specific keys for optimistic updates
- Use `queryClient.setQueryData()` for optimistic updates (advanced)

## Server Function Pattern

Server functions in `service.ts` are the RPC endpoints. They:
1. Validate input with Zod
2. Check permissions
3. Apply rate limiting (for writes)
4. Call database functions
5. Log audit events (for writes)

```typescript
// Pattern for write operations
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
      // 1. Authorization
      const session = await requirePermission('products', 'edit');

      // 2. Rate limiting
      await checkRateLimit(`write:${session.user.id}`);

      // 3. Database import (lazy-loaded)
      const { updateProduct, getProductById } = await import('@/lib/db/products');

      // 4. Fetch before state for audit
      const before = await getProductById(id);

      // 5. Perform mutation
      const updated = await updateProduct(id, values);

      // 6. Audit log
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
```

**Why lazy-load database imports?**
- Keeps server code out of client bundle
- Reduces initial bundle size
- TanStack Start handles the code splitting

## Exceptions: When NOT to Force Generic CRUD

Not every feature needs the full CRUD pattern. Use judgment for these cases:

### 1. Read-Only Features
If a feature only displays data (no create/update/delete), you may not need:
- Mutation files
- Full validation schemas

**Example:** Dashboard widgets, reports, analytics

### 2. Domain-Specific Operations
Some operations don't fit CRUD. Use domain-specific server functions.

**Example:** Attendance check-in/out
```typescript
// Not "createAttendance", but domain-specific
export const checkInFn = createServerFn({ method: 'POST' })
  .validator(checkInSchema)
  .handler(async ({ data }) => {
    await requirePermission('attendance', 'add');
    // Domain logic: validate location, time, etc.
    return performCheckIn(data);
  });
```

### 3. Complex Multi-Step Operations
When an operation involves multiple entities or steps, consider a dedicated service function.

**Example:** Employee onboarding (creates employee, user, assigns role, sends email)

### 4. Real-Time or Event-Driven Features
Features with WebSocket/SSE may need different patterns.

## Do's and Don'ts

### Do's ✅

1. **Do** use the products feature as a reference
2. **Do** export types from `queries.ts` for convenience
3. **Do** use `z.coerce` for URL/search param validation
4. **Do** invalidate queries in `onSuccess` of mutations
5. **Do** lazy-load database imports in server functions
6. **Do** add audit logging for all write operations
7. **Do** use `withRequestContext` for request-scoped logging
8. **Do** check permissions at the RPC boundary (server functions)

### Don'ts ❌

1. **Don't** skip validation - always validate at RPC boundary
2. **Don't** put database logic in server functions - use `lib/db/` modules
3. **Don't** forget rate limiting on write operations
4. **Don't** use `any` type - define proper types
5. **Don't** mix authorization concerns - use `requirePermission()`
6. **Don't** hardcode query keys - use the factory pattern
7. **Don't** skip error handling in database functions
8. **Don't** import server-only code in client components

## Quick Checklist for New Features

When creating a new feature, follow this checklist:

- [ ] Create `types.ts` with entity, filters, and response types
- [ ] Create `validation.ts` with Zod schemas
- [ ] Create `queries.ts` with query key factory and query options
- [ ] Create `mutations.ts` with mutation options and invalidation
- [ ] Create `service.ts` with server functions and authorization
- [ ] Create database functions in `lib/db/your-feature.ts`
- [ ] Add permission checks in `lib/db/role-groups.ts` if needed
- [ ] Create components following existing patterns
- [ ] Add routes with proper loader and search validation
- [ ] Test the full CRUD flow

## Why This Pattern?

This pattern exists because it:

1. **Separates concerns**: Each file has a single responsibility
2. **Type safety**: End-to-end TypeScript from database to UI
3. **Consistency**: Every feature looks the same, reducing cognitive load
4. **Maintainability**: Easy to find and fix issues
5. **Scalability**: Pattern works for simple and complex features
6. **Security**: Authorization and validation at every layer
7. **Performance**: Lazy loading and efficient cache invalidation

## Getting Help

If you're unsure about the pattern:
1. Check the products feature first
2. Ask in the team chat
3. Update this documentation if you discover a better way

---

**Remember:** Consistency is more important than perfection. When in doubt, follow the products feature pattern.
