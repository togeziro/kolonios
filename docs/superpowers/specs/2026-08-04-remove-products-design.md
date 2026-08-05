# Remove Products Feature Design

## Goal

Remove the current generic products CRUD feature completely because it is no
longer relevant to development. This work does not replace it with inventory
management. A future inventory feature will be designed separately around its
own domain model.

## Scope

Remove the following runtime and development artifacts:

- Dashboard routes `/dashboard/product` and `/dashboard/product/$productId`.
- The complete `src/features/products/` feature slice.
- Product data-access and schema exports.
- Product seed data.
- Product unit, schema, and E2E tests.
- Product navigation entries and `products.*` permission/module references.
- Active documentation that presents product management or inventory as an
  available feature.

Do not add a redirect, compatibility route, placeholder page, or inventory
replacement. Do not refactor generic components that are not product-specific.

## Persistence Changes

Remove the `products` table and `product_category` enum from the Drizzle
schema and schema index. Generate a versioned migration that drops the table
and then the enum in a safe order. The migration is intentionally destructive;
development product data is disposable and no application-level backup is
required.

The seed script must stop inserting products while continuing to seed all
remaining domains. The flexible role-group permission JSON does not require a
data migration, but role-group seed data must no longer generate product
permissions.

## Source Cleanup

Delete product routes, components, API types, validation, queries, mutations,
services, constants, and product-specific database functions. Remove imports
from shared indexes and route/navigation configuration. Search for and remove
active references to product identifiers, route paths, query keys, and
permission keys.

Historical changelog or audit entries may retain factual historical mentions,
unless they describe product management as a currently supported feature or
canonical implementation.

## Verification

Run the following after implementation:

- `bun run typecheck`
- The remaining unit/schema test suite.
- Remaining E2E tests, excluding deleted product specs.
- `bun run build`
- A repository search for product runtime identifiers, `/dashboard/product`,
  `productCategoryEnum`, and `products.*` permission references.
- Apply the generated migration to the development database and verify that
  neither `products` nor `product_category` exists.

Completion requires the application to start, typecheck, test, and build
without product-specific runtime or schema references.

## Error Handling

No new error handling is needed because the feature is removed rather than
replaced. Verification focuses on finding broken imports, stale route entries,
schema references, fixtures, and documentation claims.
