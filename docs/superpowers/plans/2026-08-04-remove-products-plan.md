# Remove Products Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the generic products CRUD feature, its database objects, seed data, permissions, tests, routes, and active documentation without adding an inventory replacement.

**Architecture:** Delete the product feature slice and its dashboard routes, then remove its Drizzle schema and generate a destructive migration that drops `products` before `product_category`. Clean shared navigation, role-group seed permissions, and active docs while preserving generic components and factual historical notes.

**Tech Stack:** TanStack Start, TanStack Router, React Query, Drizzle ORM/PostgreSQL, Bun, Vitest, Playwright.

## Global Constraints

- Do not add a redirect, compatibility route, placeholder page, or inventory replacement.
- Development product data is disposable; the migration may destructively drop `products` and `product_category`.
- Do not refactor generic components that are not product-specific.
- Do not revert unrelated existing worktree changes; stage only files belonging to the current task.
- Active documentation must not present product management or inventory as an available feature.

---

### Task 1: Remove Product Runtime And Schema Code

**Files:**
- Delete: `src/features/products/` (entire feature slice)
- Delete: `src/routes/dashboard/product/index.tsx`
- Delete: `src/routes/dashboard/product/$productId.tsx`
- Delete: `src/lib/db/products.ts`
- Delete: `src/lib/db/schema/products.ts`
- Modify: `src/lib/db/schema/index.ts` to remove the product schema export
- Modify: `drizzle.config.ts` to remove `./src/lib/db/schema/products.ts` from the schema list
- Modify: the checked-in generated route tree, if present, to remove only product route entries

**Interfaces:**
- Consumes: product route imports, product feature API exports, and the `products`/`productCategoryEnum` schema exports.
- Produces: no product route, feature module, data-access module, or schema export for later tasks to resolve.

- [ ] **Step 1: Record the exact product runtime references before deletion**

Run:

```bash
rg -n "features/products|dashboard/product|productCategoryEnum|from './products'|from '@/lib/db/products'" src e2e scripts
```

Expected: references are limited to the product slice, product routes, shared configuration, tests, seed, or generated route metadata.

- [ ] **Step 2: Delete product-specific runtime files**

Delete the complete `src/features/products/` directory, both product dashboard route files, `src/lib/db/products.ts`, and `src/lib/db/schema/products.ts`. Remove only product imports from `src/lib/db/schema/index.ts`; leave all other schema exports unchanged.

- [ ] **Step 3: Regenerate route metadata using the repository’s existing generation path**

Run the project’s normal typecheck or build command after source deletion so TanStack Router regenerates any checked-in route tree. If route metadata is checked in, remove only entries for `/dashboard/product` and `/dashboard/product/$productId`; do not hand-edit unrelated routes.

- [ ] **Step 4: Check the runtime source for broken product references**

Run:

```bash
rg -n "features/products|dashboard/product|productCategoryEnum|productKeys|ProductForm|ProductListingPage|getProductsFn|createProductFn|updateProductFn|deleteProductFn" src
```

Expected: no matches in active source.

- [ ] **Step 5: Commit the runtime deletion**

```bash
git add src/features/products src/routes/dashboard/product src/lib/db/products.ts src/lib/db/schema/products.ts src/lib/db/schema/index.ts drizzle.config.ts
git commit -m "refactor: remove products runtime feature"
```

### Task 2: Remove Navigation, Permissions, And Seed Data

**Files:**
- Modify: `src/config/nav-config.ts` to remove the product navigation item
- Modify: `src/features/role-groups/modules.ts` to remove the `products` module definition
- Modify: role-group seed data wherever `products.view/add/edit/delete` is emitted
- Modify: `src/config/infoconfig.ts` to remove product-only infobar content and imports
- Modify: `scripts/seed.ts` to remove product inserts and product schema imports
- Modify: `scripts/i18n-hardcoded-baseline.txt` to remove product component entries
- Modify: affected navigation or role-group tests to assert the remaining configuration

**Interfaces:**
- Consumes: the product runtime deletion from Task 1.
- Produces: navigation and seeded permissions that expose only supported application modules.

- [ ] **Step 1: Locate configuration and seed references**

Run:

```bash
rg -n "products|product|Product" src/config src/features/role-groups src/lib src/hooks scripts src/test-utils
```

Classify each match before editing. Remove product-specific configuration, but preserve unrelated customer, employee, attendance, and generic table code.

- [ ] **Step 2: Remove the product navigation item and module metadata**

Delete the product item from `src/config/nav-config.ts`, remove the `products` entry from `src/features/role-groups/modules.ts`, and remove product-only permission fixtures from role-group tests. Do not change the generic permission filtering implementation.

- [ ] **Step 3: Remove product seed inserts**

Delete the product import, product category/type usage, product factory, and product insert loop from `scripts/seed.ts`. Keep the seed order and all non-product seed data intact.

Also remove the product-only notification fixture from `scripts/seed.ts`; it currently uses the product catalog wording and `view-product` action. Keep all non-product notification fixtures intact.

- [ ] **Step 4: Update configuration tests**

Adjust `src/config/nav-config.test.ts` or role-group tests only where they explicitly expect the removed product item/module. Add an assertion that no navigation item URL is `/dashboard/product` if the existing test style supports this without creating a new abstraction.

- [ ] **Step 5: Verify configuration and seed references are gone**

Run:

```bash
rg -n "products|product|Product" src/config src/features/role-groups src/lib src/hooks scripts src/test-utils
```

Expected: no product-specific navigation, permission, seed, or test-fixture references; unrelated domain names may still match the generic word `product` in prose only outside this scope.

- [ ] **Step 6: Commit configuration cleanup**

```bash
git add src/config/nav-config.ts src/config/nav-config.test.ts src/config/infoconfig.ts src/features/role-groups/modules.ts scripts/seed.ts scripts/i18n-hardcoded-baseline.txt
git commit -m "refactor: remove product navigation and seed data"
```

### Task 3: Remove Product Tests And Generate The Database Migration

**Files:**
- Delete: `src/lib/db/products.test.ts`
- Delete: `src/lib/db/schema/products.test.ts`
- Delete: `src/features/products/schemas/product.test.ts` if it remains after Task 1
- Delete: `e2e/product-crud.spec.ts`
- Delete: `e2e/product-table.spec.ts`
- Create: generated Drizzle migration under `src/lib/db/migrations/`
- Modify: generated migration metadata if created by Drizzle

**Interfaces:**
- Consumes: the schema without `products` and `product_category` from Task 1, plus the seed cleanup from Task 2.
- Produces: a reproducible migration that removes product persistence and a test suite containing no product-specific specs.

- [ ] **Step 1: Remove product-only tests**

Delete the product data-access, schema, validation, CRUD E2E, and product-table E2E tests. Inspect the existing diff in `e2e/product-crud.spec.ts` before deleting it, then remove the file because the route it tests is intentionally removed. Do not delete shared test utilities solely because products previously used them.

- [ ] **Step 2: Generate the Drizzle migration**

Run:

```bash
bun run db:generate
```

Inspect the generated SQL and metadata. The migration must drop `products` before `product_category`; if Drizzle does not emit the required enum drop or emits an unsafe order, edit the generated migration with `apply_patch` so it contains the equivalent safe SQL and does not alter unrelated tables.

- [ ] **Step 3: Verify migration contents**

Run:

```bash
rg -n "products|product_category|DROP TABLE|DROP TYPE" src/lib/db/migrations
```

Expected: the only active persistence references are the intentional migration statements and historical documentation.

- [ ] **Step 4: Apply the migration to the development database**

Run:

```bash
bun run db:migrate:run
```

Then verify with the project’s PostgreSQL client or database shell that `to_regclass('public.products')` is null and `pg_type.typname = 'product_category'` has no row.

- [ ] **Step 5: Commit test and migration cleanup**

```bash
git add src/lib/db/products.test.ts src/lib/db/schema/products.test.ts src/features/products e2e/product-crud.spec.ts e2e/product-table.spec.ts src/lib/db/migrations
git commit -m "refactor: remove product persistence and tests"
```

### Task 4: Update Active Documentation And Validate The Repository

**Files:**
- Modify: `README.md`
- Modify: `docs/PRD.md`
- Modify: `docs/API.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ATTENDANCE.md` only if its current active text references products as supported functionality
- Modify: active task/TODO documentation where product management is listed as current scope
- Modify: generated API documentation inputs or output only when the product endpoint is still generated after source deletion
- Do not rewrite factual historical entries in `docs/CHANGELOG.md` or audit archives unless they claim the removed feature is currently supported or canonical

**Interfaces:**
- Consumes: all source, config, test, and migration changes from Tasks 1-3.
- Produces: documentation that describes the supported application without product management or inventory claims.

- [ ] **Step 1: Find active documentation claims**

Run:

```bash
rg -n -i "product management|product CRUD|inventory \(products\)|products|/dashboard/product" README.md docs --glob '*.md'
```

Classify matches as active documentation or historical record. Remove active feature lists, links, API tables, architecture module lists, product seed claims, and product-specific examples. Preserve factual historical changelog/audit entries unless they present the feature as current or canonical.

- [ ] **Step 2: Update active docs without introducing inventory scope**

Replace removed product references with the remaining supported domains only. Do not add an inventory roadmap promise or describe a future inventory data model in this removal task.

- [ ] **Step 3: Verify no active references remain**

Run:

```bash
rg -n "dashboard/product|productCategoryEnum|products\.(view|add|edit|delete)|getProductsFn|createProductFn|updateProductFn|deleteProductFn|features/products" src scripts e2e README.md docs --glob '!docs/superpowers/audit/**' --glob '!docs/CHANGELOG.md'
```

Expected: no matches.

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
bun run typecheck
bun run test:run
bun run build
```

Expected: all commands exit successfully, and no test attempts to load the removed product schema or route.

- [ ] **Step 5: Inspect the final diff and status**

Run:

```bash
git status --short
git diff HEAD~4..HEAD --stat
git diff --check HEAD~4..HEAD
```

Review that only product removal files are included in the implementation commits and that unrelated pre-existing worktree changes remain untouched.

- [ ] **Step 6: Commit documentation and final cleanup**

```bash
git add -p README.md docs/PRD.md docs/API.md docs/ARCHITECTURE.md docs/ATTENDANCE.md docs/TODO.md
git commit -m "docs: remove products feature references"
```

If a listed documentation file has no product-related change, do not stage it.
