# Kolonios Integration & Authorization Design

**Date:** 2026-08-03  
**Status:** Draft  
**Scope:** Authorization consolidation, OpenAPI for external integrations, Tripay/MikroTik adapters, CRUD standardization

---

## 1. Authorization Model Consolidation

### Current State

Two authorization models coexist:

**Legacy model:**
- Role stored in `user.role` column: `'admin' | 'hr' | 'employee' | 'technician' | 'customer' | 'user'`
- Guards: `requireRole()`, `requireMinRole()`, `requireAdmin()`, `requireHR()`, `requireEmployee()`, `requireTechnician()`
- Hierarchical tiers: employee ≡ technician < hr < admin

**New model (role groups):**
- `role_groups` table with JSONB `permissions` and `is_admin` flag
- `user_role_groups` junction table
- Guard: `requirePermission(module, action)`
- Client hook: `useRoleGroupPermissions`
- Permission format: `module.action` where actions are `view`, `add`, `edit`, `delete`

### Decision

**Single source of truth:** `role_groups.permissions` + `role_groups.is_admin`

**Rules:**
1. All module access decisions use `requirePermission(module, action)`
2. `role_groups.is_admin` is the only admin bypass
3. `user.role` is retained only for Better Auth compatibility, not for authorization
4. Legacy helpers (`requireRole`, `requireMinRole`, etc.) are removed after audit
5. Every user must have a `user_role_groups` assignment; unassigned users are denied

### Implementation Steps

1. Audit all call sites of legacy helpers
2. Ensure all features use `requirePermission()`
3. Verify every user has a role group assignment
4. Unify admin bypass to use `role_groups.is_admin` only
5. Remove legacy helpers and related types (`validRoles`, `roleSets`, `tierOf`, `tierLabel`)
6. Update tests to cover permission matrix, custom role groups, unassigned users
7. Update docs/API.md and ARCHITECTURE.md

---

## 2. OpenAPI & External Integrations

### Direction

OpenAPI is **kept** and scoped to external-facing endpoints only.

**Two integration directions:**

```
Kolonios -> Tripay API        (outbound)
Kolonios -> MikroTik API      (outbound)

External App -> Kolonios API  (inbound, documented by OpenAPI)
```

### OpenAPI Scope

Only document endpoints that external consumers need:

- `POST /api/v1/payments/webhook`
- `GET /api/v1/customers/:id/service-status`
- `POST /api/v1/customers/:id/suspend`
- `POST /api/v1/customers/:id/activate`

Internal server functions (dashboard CRUD) are not exposed in OpenAPI.

### Integration Architecture

```
External Consumer
        |
        v
Kolonios API (OpenAPI documented)
        |
        v
Domain Service (billing, network)
        |
        +---> Tripay Adapter    -> Tripay API
        +---> MikroTik Adapter  -> MikroTik RouterOS API
```

### Tripay Integration

**Required capabilities:**
- Create transaction
- Check transaction status
- Receive webhook/callback
- Verify callback signature
- Map provider status to internal status
- Idempotent processing (prevent duplicate payments)

**Data model:**
```
payments
- id
- customer_id
- provider (e.g., 'tripay')
- external_reference
- amount
- status (pending/paid/failed)
- raw_status
- paid_at
- created_at
- updated_at
```

**Environment:**
```
TRIPAY_API_KEY=
TRIPAY_PRIVATE_KEY=
TRIPAY_MERCHANT_CODE=
```

### MikroTik Integration

**Required capabilities:**
- Connect to RouterOS API
- Provision customer service (PPPoE/user)
- Suspend/activate service
- Query service status
- Timeout and retry handling
- Error mapping

**Environment:**
```
MIKROTIK_HOST=
MIKROTIK_USERNAME=
MIKROTIK_PASSWORD=
MIKROTIK_PORT=8728
```

### File Structure

```
src/integrations/
├── tripay/
│   ├── client.ts          # HTTP client with auth
│   ├── types.ts           # Tripay request/response types
│   ├── mapper.ts          # Status mapping
│   ├── service.ts         # Business logic wrapper
│   └── webhook.ts         # Signature verification
├── mikrotik/
│   ├── client.ts          # RouterOS API client
│   ├── types.ts
│   └── service.ts
└── shared/
    ├── http-client.ts     # Base HTTP client
    └── integration-errors.ts
```

---

## 3. UI/Theme/Font Dependencies

### Decision

Dependencies are **retained** if they serve a documented purpose. No aggressive removal.

### Approach

1. Inventory all UI/theme/font dependencies
2. Classify as:
   - **Core:** actively used by components
   - **Design system:** intentionally available for future features
   - **Unused:** no current or planned usage
3. Only remove **unused** dependencies with clear maintenance cost
4. Document retained dependencies in ARCHITECTURE.md

### Radix UI Components

Many `@radix-ui/react-*` packages are installed. These are expected when using shadcn/ui. Audit which primitives are actually imported before considering removal.

---

## 4. CRUD Pattern Standardization

### Goal

Standardize **file structure and naming**, not business logic.

### Standard Structure

```
features/<name>/api/
├── types.ts         # Entity, filters, payloads, responses
├── validation.ts    # Zod schemas (create, update, filter)
├── service.ts       # Server functions with auth boundary
├── queries.ts       # Query keys + queryOptions
└── mutations.ts     # Mutations + cache invalidation
```

### Query Key Pattern

```ts
const entityKeys = {
  all: ['entity'] as const,
  list: (filters: EntityFilters) => [...entityKeys.all, 'list', filters] as const,
  detail: (id: string) => [...entityKeys.all, 'detail', id] as const,
};
```

### Response Envelope

```ts
{
  success: boolean;
  time: string;
  message: string;
  // + entity-specific fields
}
```

### Apply To

Start with simple CRUD features:
- products
- customers
- employees
- departments
- designations

### Exceptions

Domain-specific functions are NOT forced into generic CRUD:
- `checkIn()`, `checkOut()` (attendance)
- `claimTask()` (tasks)
- `generateCustomerCode()` (customers)

---

## 5. Implementation Priority

1. **Authorization consolidation** (blocks all other work)
2. **OpenAPI scoping** (needed before integrations)
3. **Tripay adapter** (payment integration)
4. **MikroTik adapter** (network provisioning)
5. **CRUD standardization** (developer experience)
6. **Dependency audit** (cleanup, non-blocking)

---

## 6. Verification

After each phase:
- `bun run typecheck`
- `bun run test:run`
- `bun run lint`
- `bun run build`

Manual testing with all role groups:
- admin
- hr
- employee
- technician
- custom role group
- unassigned user

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Removing legacy auth breaks hidden callers | Full audit + test coverage before removal |
| OpenAPI exposes internal endpoints | Explicitly scope which server functions generate OpenAPI |
| Tripay webhook replay attacks | Signature verification + idempotency key |
| MikroTik credentials leak | Environment variables + no logging of secrets |
| Over-standardization kills domain logic | Exceptions explicitly allowed for domain-specific features |
