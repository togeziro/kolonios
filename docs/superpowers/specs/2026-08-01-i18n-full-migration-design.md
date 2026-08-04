# i18n Full Migration — Design

Date: 2026-08-01
Status: Approved by user

## Problem

The app has i18next with EN/ID locales, but only a fraction of the UI is actually
translated. Clicking "ID" in the language switcher changes the language for the
few components using `useTranslation`, while ~600+ user-facing strings remain
hardcoded English (JSX text, attributes, toasts, table headers, option labels).

Two additional defects:

1. **Language choice not persisted.** `changeLanguage` never writes the `i18next`
   cookie, and the `detection` config in `src/i18n/config.ts` is inert because
   `i18next-browser-languagedetector` was removed. On reload, SSR falls back to
   `Accept-Language`/`en`.
2. **`<html lang>` not updated on switch.** It is set once from the loader.

## Goals

- When the user clicks "ID", **all functional UI** switches to Indonesian:
  forms, tables, dashboards, toasts, column headers, option labels.
- The **codebase stays 100% English**: translation keys, variable names,
  comments, and the values in `en/translation.json`. Indonesian exists only as
  *values* in `id/translation.json`. This keeps development unambiguous.
- Language choice persists across reloads.

## Non-Goals (explicitly out of scope)

- Legal pages (Terms of Service, Privacy Policy, About) stay English.
- Table filter `meta.label`/`meta.placeholder` stay English.
- Server-side error messages (`mapDbError`, zod validation messages) stay English.
- Data-driven values (record names from DB) are not translated.

## Architecture

No new libraries. Reuse the existing i18next + react-i18next setup.

### 1. String migration → `t()`

New namespaces in `translation.json`, following the existing per-feature
pattern (`product.*`, `user.*`, `roleGroups.*`):

- `employee.*`
- `customer.*`
- `attendance.*`
- `task.*`
- `masterdata.*` (departments & designations)
- `audit.*`
- `profile.*`
- `overview.*` (extend existing)
- `auth.*` (extend existing)
- `common.*` (extend existing)
- `navigation.*`, `table.*`, `notifications.*` (extend existing)

Migration rules:

- JSX text: `{t('employee.form.name')}`
- JSX attributes: `placeholder={t('employee.form.namePlaceholder')}`, `aria-label={t(...)}`
- Toasts: `toast.success(t('employee.created'))` — pattern already used in
  `src/features/role-groups/components/role-group-listing.tsx:19`
- Every new key added to BOTH `en/translation.json` (English value) and
  `id/translation.json` (Indonesian value).

### 2. Table columns & filters (header-only approach)

Columns stay module-scope (no hooks there). Instead:

- `DataTableColumnHeader` (`src/components/ui/table/data-table-column-header.tsx`)
  calls `useTranslation()` internally and renders `t(title)`. Callers change
  `title='Name'` → `title='employee.name'` (translation key).
- Plain string headers (`header: 'STATUS'`) convert to translation keys via a
  tiny translated wrapper or `header: () => ...` render fn using the same
  internal hook pattern.
- `meta.label` / `meta.placeholder` (toolbar filters) remain English — documented
  limitation, no code change needed there.

### 3. Option arrays (status/category dropdowns)

Option arrays (`options.tsx` files) are module-scope. The *consumers* are React
components and can use hooks:

- `src/components/forms/fields/select-field.tsx:60` (`opt.label`)
- `src/components/ui/table/data-table-faceted-filter.tsx:106,135` (`option.label`)

Change these consumers to call `useTranslation()` and render `t(option.labelKey)`
(or keep `option.label` as the key). Option arrays change `label: 'Active'` →
`labelKey: 'common.active'`. Keys are added to both locales.

### 4. Language persistence fix

In `src/components/language-switcher.tsx`, after `i18n.changeLanguage(lng)`:

- Write cookie `i18next=<lng>; path=/; max-age=31536000; SameSite=Lax`
  (mirroring `src/components/themes/active-theme.tsx:11`).
- Set `document.documentElement.lang = lng`.

SSR in `src/routes/__root.tsx:42-65` already reads the `i18next` cookie, so
reloads restore the choice.

### 5. Quality control

- `bun run i18n:check` — key parity between en/id must pass.
- `bun run i18n:hardcoded` — regenerate baseline with `bun run i18n:baseline`
  after migration; remaining baseline entries should be legal pages only.
- `bun run typecheck`, `bun run lint`, `bun run test` all pass.
- Manual test: click ID → forms/tables/dashboard/toasts switch; reload → stays ID.

## File touch map (approximately 60 files)

- `src/i18n/locales/en/translation.json` — add keys
- `src/i18n/locales/id/translation.json` — add keys
- `src/components/language-switcher.tsx` — persistence fix
- `src/components/ui/table/data-table-column-header.tsx` — internal `useTranslation`
- `src/components/forms/fields/select-field.tsx`, `data-table-faceted-filter.tsx` — option label translation
- ~60 feature/route `.tsx` files with hardcoded strings (see `scripts/i18n-hardcoded-baseline.txt`)
- `scripts/i18n-hardcoded-baseline.txt` — regenerated
- Toast call sites (~17 files, 63 calls)

## Verification plan

1. `bun run i18n:check` → OK
2. `bun run i18n:hardcoded` → OK (baseline shrinks to legal pages)
3. `bun run typecheck` → OK
4. `bun run lint` → OK
5. `bun run test` → OK
6. Manual: switch to ID, verify a form, a table, a toast, and reload persistence.
