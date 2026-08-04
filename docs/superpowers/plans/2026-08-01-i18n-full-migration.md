# i18n Full Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user-facing UI string switches to Indonesian when the user clicks "ID" in the language switcher, while the codebase stays 100% English, and the language choice persists across reloads.

**Architecture:** Migrate all hardcoded UI strings (~600 across ~60 files) to `useTranslation()` / `t()` calls with per-feature English namespaces. Values live in `en/translation.json` (English) and `id/translation.json` (Indonesian). The only non-component locations needing hooks are solved by translating inside the consumer components (`DataTableColumnHeader`, `DataTableFacetedFilter`, `select-field`), which already receive translation keys via `title`/`labelKey` props.

**Tech Stack:** i18next 26 + react-i18next 17 (already installed), TypeScript, TanStack Start/Router.

**Spec:** `docs/superpowers/specs/2026-08-01-i18n-full-migration-design.md`

## Global Constraints

- **Code is 100% English**: keys, variable names, comments, `en/translation.json` values. Indonesian appears ONLY as values in `id/translation.json`.
- Every new key MUST be added to BOTH `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json` in the same task.
- Keep the existing per-feature namespace pattern (`product.*`, `user.*`, `roleGroups.*`).
- `bun run i18n:check` must pass after every task (en/id key parity).
- `bun run typecheck` must pass after every task.
- Do NOT migrate: `src/routes/terms-of-service.tsx`, `src/routes/privacy-policy.tsx`, `src/routes/about.tsx` (legal pages — stay hardcoded).
- Do NOT translate: server-side error messages (`mapDbError`, validation), `meta.label`/`meta.placeholder` in table column defs, DB data values (record names, statuses rendered from data).
- Existing i18n keys are reused; add `common.*`/`table.*`/`navigation.*`/`auth.*`/`product.*`/`user.*`/`roleGroups.*` extensions rather than duplicating.
- Toast messages use `t()` via the component's `useTranslation` hook (pattern: `src/features/role-groups/components/role-group-listing.tsx:19`).
- Commits follow the repo style (`feat(i18n): ...`).

---

### Task 1: Infrastructure — persistence, `<html lang>`, table header & option translation hooks

**Files:**
- Modify: `src/components/language-switcher.tsx`
- Modify: `src/components/ui/table/data-table-column-header.tsx`
- Modify: `src/components/ui/table/data-table-pagination.tsx`
- Modify: `src/components/ui/table/data-table-view-options.tsx`
- Modify: `src/components/ui/table/data-table-faceted-filter.tsx`
- Modify: `src/components/ui/table/data-table-date-filter.tsx`
- Modify: `src/components/forms/fields/select-field.tsx`
- Modify: `src/components/layout/page-container.tsx`

**Interfaces:**
- Consumes: existing `I18nProvider`, `i18n.changeLanguage`, `useTranslation`.
- Produces: `DataTableColumnHeader` renders `t(title)` where `title` is a translation key; `DataTableFacetedFilter` renders `t(option.label)` where `option.label` is a key; `select-field` renders `t(opt.label)`; cookie `i18next` written on switch. Later tasks pass keys into `title='employee.name'` style props.

- [ ] **Step 1: Persistence + `<html lang>` in language-switcher**

```tsx
// src/components/language-switcher.tsx
import { useTranslation } from 'react-i18next';
import { supportedLanguages, type SupportedLanguage } from '@/i18n/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

const languageLabels: Record<SupportedLanguage, string> = {
  en: 'English',
  id: 'Indonesia'
};

const languageCodes: Record<SupportedLanguage, string> = {
  en: 'EN',
  id: 'ID'
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language as SupportedLanguage;

  const changeLanguage = (lng: SupportedLanguage) => {
    i18n.changeLanguage(lng);
    document.cookie = `i18next=${lng}; path=/; max-age=31536000; SameSite=Lax; ${
      window.location.protocol === 'https:' ? 'Secure;' : ''
    }`;
    document.documentElement.lang = lng;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='h-8 w-8'>
          <Icons.globe className='h-4 w-4' />
          <span className='sr-only'>{languageLabels[currentLanguage] || currentLanguage}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[120px]'>
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => changeLanguage(lang)}
            className={cn(currentLanguage === lang && 'bg-accent font-medium')}
          >
            <span className='font-mono text-xs'>{languageCodes[lang]}</span>
            <span className='ml-2'>{languageLabels[lang]}</span>
            {currentLanguage === lang && <Icons.check className='ml-auto h-4 w-4' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: `DataTableColumnHeader` — translate `title` internally**

`title` prop now carries a translation key. Add `useTranslation`:

```tsx
// src/components/ui/table/data-table-column-header.tsx — add import + hook + render
import { useTranslation } from 'react-i18next';
// inside component, after destructuring:
const { t } = useTranslation();
// replace {title} at line 28 (plain header) with {t(title)}
// replace {title} at line 40 (dropdown trigger) with {t(title)}
```

Resulting render calls: `return <div className={cn(className)}>{t(title)}</div>;` and `{t(title)}` inside the trigger. Do NOT translate "Asc"/"Desc"/"Reset"/"Hide" menu items yet (Task 1 step 5 adds `table.*` keys — fold them in here).

- [ ] **Step 3: `DataTablePagination` — translate visible strings**

```tsx
// src/components/ui/table/data-table-pagination.tsx — add import + hook
import { useTranslation } from 'react-i18next';
// inside component:
const { t } = useTranslation();
// line 38: {table.getFilteredSelectedRowModel().rows.length} of{' '}
//          {table.getFilteredRowModel().rows.length} row(s) selected.
//   → {t('table.rowsSelected', { selected: table.getFilteredSelectedRowModel().rows.length, total: table.getFilteredRowModel().rows.length })}
// line 41: {table.getFilteredRowModel().rows.length} row(s) total.
//   → {t('table.rowsTotal', { total: table.getFilteredRowModel().rows.length })}
// line 46: Rows per page → {t('table.rowsPerPage')}
// line 66: Page {index} of {count} → {t('table.pageOf', { page: table.getState().pagination.pageIndex + 1, total: table.getPageCount() })}
// line 70: aria-label='Go to first page' → aria-label={t('table.goToFirstPage')}
// line 80: aria-label='Go to previous page' → aria-label={t('table.goToPreviousPage')}
// line 90: aria-label='Go to next page' → aria-label={t('table.goToNextPage')}
// line 100: aria-label='Go to last page' → aria-label={t('table.goToLastPage')}
```

- [ ] **Step 4: `DataTableViewOptions` — translate strings**

```tsx
// src/components/ui/table/data-table-view-options.tsx — add import + hook
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// line 35: aria-label='Toggle columns' → aria-label={t('table.toggleColumns')}
// line 41: View → {t('table.view')}
// line 47: placeholder='Search columns...' → placeholder={t('table.searchColumns')}
// line 49: No columns found. → {t('table.noColumnsFound')}
```

- [ ] **Step 5: `DataTableFacetedFilter` — translate option labels + clear button**

```tsx
// src/components/ui/table/data-table-faceted-filter.tsx — add import + hook
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// line 95: {selectedValues.size} selected → {t('table.selectedCount', { count: selectedValues.size })}
// line 106: {option.label} → {t(option.label)}
// line 119: No results found. → {t('common.noResults')}
// line 135: {option.label} → {t(option.label)}
// line 148: Clear filters → {t('table.clearFilters')}
```

- [ ] **Step 6: `DataTableDateFilter` — translate placeholder strings**

```tsx
// src/components/ui/table/data-table-date-filter.tsx — add import + hook
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// line 126: 'Select date range' → t('table.selectDateRange')
// line 147: 'Select date' → t('table.selectDate')
```

- [ ] **Step 7: `select-field` — translate option labels via `labelKey`**

```tsx
// src/components/forms/fields/select-field.tsx — add import + hook
import { useTranslation } from 'react-i18next';
// inside component (useFormFields context): const { t } = useTranslation();
// line 60: {opt.label} → {t(opt.label)}
```

Options arrays will carry `labelKey` values that match keys; Task 3-5 set `label: 'active'`-style keys on the option arrays consumed here.

- [ ] **Step 8: `PageContainer` — translate access-denied text**

```tsx
// src/components/layout/page-container.tsx — add import + hook
import { useTranslation } from 'react-i18next';
// inside component: const { t } = useTranslation();
// line 44: You do not have access to this page. → {t('common.noAccess')}
```

- [ ] **Step 9: Add the shared/table keys to BOTH locale files**

Add to `src/i18n/locales/en/translation.json` and `id/translation.json` under `table`:

| key | EN | ID |
|---|---|---|
| `table.rowsSelected` | `{{selected}} of {{total}} row(s) selected.` | `{{selected}} dari {{total}} baris dipilih.` |
| `table.rowsTotal` | `{{total}} row(s) total.` | `{{total}} baris total.` |
| `table.pageOf` | `Page {{page}} of {{total}}` | `Halaman {{page}} dari {{total}}` |
| `table.goToFirstPage` | `Go to first page` | `Ke halaman pertama` |
| `table.goToPreviousPage` | `Go to previous page` | `Ke halaman sebelumnya` |
| `table.goToNextPage` | `Go to next page` | `Ke halaman berikutnya` |
| `table.goToLastPage` | `Go to last page` | `Ke halaman terakhir` |
| `table.toggleColumns` | `Toggle columns` | `Alihkan kolom` |
| `table.view` | `View` | `Lihat` |
| `table.searchColumns` | `Search columns...` | `Cari kolom...` |
| `table.noColumnsFound` | `No columns found.` | `Tidak ada kolom ditemukan.` |
| `table.selectedCount` | `{{count}} selected` | `{{count}} dipilih` |
| `table.selectDateRange` | `Select date range` | `Pilih rentang tanggal` |
| `table.selectDate` | `Select date` | `Pilih tanggal` |

Add to `common`:

| key | EN | ID |
|---|---|---|
| `common.noAccess` | `You do not have access to this page.` | `Anda tidak memiliki akses ke halaman ini.` |

- [ ] **Step 10: Verify**

Run: `bun run i18n:check` → Expected: `i18n key parity OK`
Run: `bun run typecheck` → Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add src/components/language-switcher.tsx src/components/ui/table/ src/components/forms/fields/select-field.tsx src/components/layout/page-container.tsx src/i18n/locales/
git commit -m "feat(i18n): persist language choice, translate table chrome via consumer hooks"
```

---

### Task 2: Auth strings — forms, v2 pages, auth-card

**Files:**
- Modify: `src/features/auth/components/auth-card.tsx`
- Modify: `src/features/auth/components/github-auth-button.tsx`
- Modify: `src/features/auth/components/register-form.tsx`
- Modify: `src/features/auth/components/user-auth-form.tsx`
- Modify: `src/routes/auth/v2.tsx`
- Modify: `src/routes/auth/v2/sign-in/index.tsx`
- Modify: `src/routes/auth/v2/sign-up/index.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `useTranslation` from react-i18next; `AuthCard` props `title/subtitle/linkLabel/linkText` (strings passed from route callers).
- Produces: extended `auth.*` keys consumed by no later task.

- [ ] **Step 1: Add auth keys to BOTH locale files**

| key | EN | ID |
|---|---|---|
| `auth.name` | `Name` | `Nama` |
| `auth.namePlaceholder` | `John Doe` | `John Doe` |
| `auth.emailPlaceholder` | `you@example.com` | `anda@contoh.com` |
| `auth.confirmPassword` | `Confirm Password` | `Konfirmasi Kata Sandi` |
| `auth.rememberMe30` | `Remember me for 30 days` | `Ingat saya selama 30 hari` |
| `auth.login` | `Login` | `Masuk` |
| `auth.continueWithGoogle` | `Continue with Google` | `Lanjutkan dengan Google` |
| `auth.copyright` | `© {{year}}, TanStack Dashboard.` | `© {{year}}, TanStack Dashboard.` |
| `auth.loginTitle` | `Login to your account` | `Masuk ke akun Anda` |
| `auth.loginSubtitle` | `Please enter your details to login.` | `Silakan masukkan detail Anda untuk masuk.` |
| `auth.createAccountTitle` | `Create an account` | `Buat akun` |
| `auth.createAccountSubtitle` | `Enter your details to get started.` | `Masukkan detail Anda untuk memulai.` |
| `auth.tagline` | `Design. Build. Launch. Repeat.` | `Rancang. Bangun. Luncurkan. Ulangi.` |
| `auth.readyToLaunch` | `Ready to launch?` | `Siap diluncurkan?` |
| `auth.readyDescription` | `Clone the repo, install dependencies, and your dashboard is live in minutes.` | `Clone repo, instal dependensi, dan dashboard Anda aktif dalam hitungan menit.` |
| `auth.needHelp` | `Need help?` | `Butuh bantuan?` |
| `auth.helpDescription` | `Check out the docs or open an issue on GitHub, community support is just a click away.` | `Lihat dokumentasi atau buka issue di GitHub, dukungan komunitas hanya satu klik lagi.` |

- [ ] **Step 2: `github-auth-button.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
// inside component:
const { t } = useTranslation();
// line 8: Continue with Github → {t('auth.signInWithGithub')}
```

- [ ] **Step 3: `register-form.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// line 65: Name → {t('auth.name')}
// line 73: placeholder='John Doe' → placeholder={t('auth.namePlaceholder')}
// line 87: Email Address → {t('auth.emailAddress')}
// line 95: placeholder='you@example.com' → placeholder={t('auth.emailPlaceholder')}
// line 112: label='Password' → label={t('auth.password')}
// line 125: label='Confirm Password' → label={t('auth.confirmPassword')}
// line 132: Create Account → {t('auth.createAccount')}
```

- [ ] **Step 4: `user-auth-form.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// line 58: Email Address → {t('auth.emailAddress')}
// line 66: placeholder='you@example.com' → placeholder={t('auth.emailPlaceholder')}
// line 83: label='Password' → label={t('auth.password')}
// line 102: Remember me for 30 days → {t('auth.rememberMe30')}
// line 108: Login → {t('auth.login')}
// line 42: toast.error(error.message || 'Sign in failed') → toast.error(error.message || t('auth.signInFailed'))
// add key auth.signInFailed: EN "Sign in failed" / ID "Gagal masuk"
```

- [ ] **Step 5: `auth-card.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
// inside component:
const { t } = useTranslation();
// line 41: © {new Date().getFullYear()}, TanStack Dashboard. →
//   {t('auth.copyright', { year: new Date().getFullYear() })}
```

- [ ] **Step 6: `routes/auth/v2.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// line 16: TanStack Dashboard → {t('navigation.dashboard')}  (keep as brand: use t('auth.brand') if clearer)
// line 17: Design. Build. Launch. Repeat. → {t('auth.tagline')}
// line 22: Ready to launch? → {t('auth.readyToLaunch')}
// line 24: Clone the repo... → {t('auth.readyDescription')}
// line 29: Need help? → {t('auth.needHelp')}
// line 31: Check out the docs... → {t('auth.helpDescription')}
```

For the brand name, add `auth.brand` = `TanStack Dashboard` (both locales).

- [ ] **Step 7: `routes/auth/v2/sign-in/index.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// line 17: title='Login to your account' → title={t('auth.loginTitle')}
// line 18: subtitle='Please enter your details to login.' → subtitle={t('auth.loginSubtitle')}
// line 19: linkLabel="Don't have an account?" → linkLabel={t('auth.dontHaveAccount')}
// line 21: linkText='Register' → linkText={t('auth.register')}
//   add key auth.register: EN "Register" / ID "Daftar"
// line 25: Continue with Google → {t('auth.continueWithGoogle')}
// line 29: Or continue with → {t('auth.orContinueWith')}
```

- [ ] **Step 8: `routes/auth/v2/sign-up/index.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
// line 17: title='Create an account' → title={t('auth.createAccountTitle')}
// line 18: subtitle='Enter your details to get started.' → subtitle={t('auth.createAccountSubtitle')}
// line 19: linkLabel='Already have an account?' → linkLabel={t('auth.alreadyHaveAccount')}
// line 21: linkText='Sign in' → linkText={t('auth.signIn')}
// line 25: Continue with Google → {t('auth.continueWithGoogle')}
// line 29: Or continue with → {t('auth.orContinueWith')}
```

- [ ] **Step 9: Verify + commit**

Run: `bun run i18n:check` and `bun run typecheck` — both must pass.
```bash
git add src/features/auth/ src/routes/auth/ src/i18n/locales/
git commit -m "feat(i18n): translate auth forms and v2 pages"
```

---

### Task 3: Attendance feature

**Files:**
- Modify: `src/features/attendance/components/attendance-check-card.tsx`
- Modify: `src/features/attendance/components/attendance-history.tsx`
- Modify: `src/features/attendance/components/leave-history.tsx`
- Modify: `src/features/attendance/components/leave-request-fields.tsx`
- Modify: `src/features/attendance/components/leave-request-form.tsx`
- Modify: `src/features/attendance/components/mobile-leave-request-sheet.tsx`
- Modify: `src/features/attendance/components/performance-snapshot.tsx`
- Modify: `src/routes/dashboard/attendance/index.tsx`
- Modify: `src/routes/dashboard/leave/index.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `useTranslation`; `statusFilters` array in leave-history gets a `labelKey` field.
- Produces: `attendance.*` keys used only within this task.

- [ ] **Step 1: Add attendance keys to BOTH locales**

| key | EN | ID |
|---|---|---|
| `attendance.todayAttendance` | `Today's Attendance` | `Absensi Hari Ini` |
| `attendance.statusLabel` | `Status:` | `Status:` |
| `attendance.checkInLabel` | `Check-in:` | `Check-in:` |
| `attendance.checkOutLabel` | `Check-out:` | `Check-out:` |
| `attendance.checkIn` | `Check In` | `Check In` |
| `attendance.checkOut` | `Check Out` | `Check Out` |
| `attendance.historyTitle` | `Attendance History` | `Riwayat Absensi` |
| `attendance.monthPlaceholder` | `Month` | `Bulan` |
| `attendance.yearPlaceholder` | `Year` | `Tahun` |
| `attendance.noRecords` | `No attendance records found` | `Tidak ada catatan absensi` |
| `attendance.shift` | `Shift` | `Shift` |
| `attendance.leaveHistory` | `Leave History` | `Riwayat Cuti` |
| `attendance.allStatus` | `All Status` | `Semua Status` |
| `attendance.pending` | `Pending` | `Menunggu` |
| `attendance.approved` | `Approved` | `Disetujui` |
| `attendance.rejected` | `Rejected` | `Ditolak` |
| `attendance.cancelled` | `Cancelled` | `Dibatalkan` |
| `attendance.noLeaveRequests` | `No leave requests found` | `Tidak ada pengajuan cuti` |
| `attendance.type` | `Type` | `Tipe` |
| `attendance.start` | `Start` | `Mulai` |
| `attendance.end` | `End` | `Selesai` |
| `attendance.days` | `Days` | `Hari` |
| `attendance.reason` | `Reason` | `Alasan` |
| `attendance.leaveType` | `Leave Type` | `Tipe Cuti` |
| `attendance.selectLeaveType` | `Select leave type` | `Pilih tipe cuti` |
| `attendance.startDate` | `Start Date` | `Tanggal Mulai` |
| `attendance.endDate` | `End Date` | `Tanggal Selesai` |
| `attendance.reasonPlaceholder` | `Optional reason for leave` | `Alasan cuti (opsional)` |
| `attendance.submitLeaveRequest` | `Submit Leave Request` | `Kirim Pengajuan Cuti` |
| `attendance.newLeaveRequest` | `New Leave Request` | `Pengajuan Cuti Baru` |
| `attendance.leaveRequestDescription` | `Submit a leave request for approval` | `Kirim pengajuan cuti untuk persetujuan` |
| `attendance.requestLeave` | `Request Leave` | `Ajukan Cuti` |
| `attendance.yourPerformance` | `Your performance` | `Performa Anda` |
| `attendance.leaveSubmitted` | `Leave request submitted` | `Pengajuan cuti terkirim` |
| `attendance.leaveSubmitFailed` | `Failed to submit leave request` | `Gagal mengirim pengajuan cuti` |
| `attendance.dayCount` | `{{count}} day` | `{{count}} hari` |
| `attendance.dayCountPlural` | `{{count}} days` | `{{count}} hari` |
| `attendance.pageTitle` | `Attendance` | `Absensi` |
| `attendance.pageDescription` | `Check in and out, view your attendance history` | `Check-in dan check-out, lihat riwayat absensi Anda` |
| `attendance.leavePageTitle` | `Leave Management` | `Manajemen Cuti` |
| `attendance.leavePageDescription` | `Submit and track leave requests` | `Kirim dan pantau pengajuan cuti` |

- [ ] **Step 2: `attendance-check-card.tsx`** — add `const { t } = useTranslation();` then:
- line 59: `Today&apos;s Attendance` → `{t('attendance.todayAttendance')}`
- line 62: `new Date().toLocaleDateString('en-US', {...})` → replace `'en-US'` with `i18n.language === 'id' ? 'id-ID' : 'en-US'` (grab `i18n` from `useTranslation()`)
- line 73: `Status:` → `{t('attendance.statusLabel')}`
- line 86: `Check-in: {...}` → `{t('attendance.checkInLabel')} {attendance!.attendance!.check_in_time}`
- line 92: `Check-out: {...}` → `{t('attendance.checkOutLabel')} {attendance!.attendance!.check_out_time}`
- line 138: `Check In` → `{t('attendance.checkIn')}`
- line 155: `Check Out` → `{t('attendance.checkOut')}`

- [ ] **Step 3: `attendance-history.tsx`** — add hook, then:
- line 56: `Attendance History` → `{t('attendance.historyTitle')}`
- line 63: `placeholder='Month'` → `placeholder={t('attendance.monthPlaceholder')}`
- line 75: `placeholder='Year'` → `placeholder={t('attendance.yearPlaceholder')}`
- line 93: `No attendance records found` → `{t('attendance.noRecords')}`
- line 101: `Date` → `{t('common.date')}` (add `common.date` EN `Date` / ID `Tanggal`)
- line 102: `Shift` → `{t('attendance.shift')}`
- line 103: `Check In` → `{t('attendance.checkIn')}`
- line 104: `Check Out` → `{t('attendance.checkOut')}`
- line 105: `Status` → `{t('common.status')}` (add `common.status` EN `Status` / ID `Status`)

- [ ] **Step 4: `leave-history.tsx`** — add hook. Change `statusFilters` to use keys:

```tsx
const statusFilters = [
  { value: '', labelKey: 'common.all' },
  { value: 'pending', labelKey: 'attendance.pending' },
  { value: 'approved', labelKey: 'attendance.approved' },
  { value: 'rejected', labelKey: 'attendance.rejected' }
] as const;
```
- line 74: `{f.label}` → `{t(f.labelKey)}`
- line 81: `placeholder='All Status'` → `placeholder={t('attendance.allStatus')}`
- line 84: `All Status` → `{t('attendance.allStatus')}`
- line 85: `Pending` → `{t('attendance.pending')}`
- line 86: `Approved` → `{t('attendance.approved')}`
- line 87: `Rejected` → `{t('attendance.rejected')}`
- line 88: `Cancelled` → `{t('attendance.cancelled')}`
- line 99: `No leave requests found` → `{t('attendance.noLeaveRequests')}`
- line 107: `Type` → `{t('attendance.type')}`; line 108: `Start` → `{t('attendance.start')}`; line 109: `End` → `{t('attendance.end')}`; line 110: `Days` → `{t('attendance.days')}`; line 111: `Status` → `{t('common.status')}`; line 112: `Reason` → `{t('attendance.reason')}`
- line 138: `{leave.leave_type} leave` → `{leave.leave_type} {t('attendance.leaveSuffix')}` (add `attendance.leaveSuffix` EN `leave` / ID `cuti`)
- line 148-149: `{leave.start_date} – {leave.end_date} · {leave.total_days} day{...'s'}` → `{leave.start_date} – {leave.end_date} · {t('attendance.dayCount', { count: leave.total_days })}` (plural handled by key count)

- [ ] **Step 5: `leave-request-fields.tsx`** — add hook, then:
- line 47: `toast.success('Leave request submitted')` → `toast.success(t('attendance.leaveSubmitted'))`
- line 58: `toast.error('Failed to submit leave request')` → `toast.error(t('attendance.leaveSubmitFailed'))`
- line 69: `Leave Type` → `{t('attendance.leaveType')}`
- line 72: `placeholder='Select leave type'` → `placeholder={t('attendance.selectLeaveType')}`
- line 86: `Start Date` → `{t('attendance.startDate')}`
- line 95: `End Date` → `{t('attendance.endDate')}`
- line 106: `Reason` → `{t('attendance.reason')}`
- line 108: `placeholder='Optional reason for leave'` → `placeholder={t('attendance.reasonPlaceholder')}`
- line 121: `Submit Leave Request` → `{t('attendance.submitLeaveRequest')}`

- [ ] **Step 6: `leave-request-form.tsx`** — add hook, then:
- line 12: `New Leave Request` → `{t('attendance.newLeaveRequest')}`
- line 14: `Submit a leave request for approval` → `{t('attendance.leaveRequestDescription')}`

- [ ] **Step 7: `mobile-leave-request-sheet.tsx`** — add hook, then:
- line 20: `Request Leave` → `{t('attendance.requestLeave')}`
- line 25: `New Leave Request` → `{t('attendance.newLeaveRequest')}`
- line 26: `Submit a leave request for approval` → `{t('attendance.leaveRequestDescription')}`

- [ ] **Step 8: `performance-snapshot.tsx`** — add hook, then:
- line 14: `Your performance` → `{t('attendance.yourPerformance')}`

- [ ] **Step 9: route pages** — `src/routes/dashboard/attendance/index.tsx`: `pageTitle='Attendance'` → `pageTitle={t('attendance.pageTitle')}`, `pageDescription=...` → `pageDescription={t('attendance.pageDescription')}` (add hook in route component). `src/routes/dashboard/leave/index.tsx`: same with `attendance.leavePageTitle`/`attendance.leavePageDescription`.

- [ ] **Step 10: Add shared keys to `common`** (used above): `common.date` EN `Date`/ID `Tanggal`, `common.status` EN `Status`/ID `Status`, `common.all` EN `All`/ID `Semua`.

- [ ] **Step 11: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/features/attendance/ src/routes/dashboard/attendance/ src/routes/dashboard/leave/ src/i18n/locales/
git commit -m "feat(i18n): translate attendance feature"
```

---

### Task 4: Customers feature

**Files:**
- Modify: `src/features/customers/components/customer-form-sheet.tsx`
- Modify: `src/features/customers/components/customer-tables/cell-action.tsx`
- Modify: `src/features/customers/components/customer-tables/columns.tsx`
- Modify: `src/features/customers/components/customer-tables/options.tsx`
- Modify: `src/routes/dashboard/customers.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `DataTableColumnHeader` translates `title` keys; `select-field`/`DataTableFacetedFilter` translate option `label` keys.
- Produces: `customer.*` keys; `STATUS_OPTIONS` labels become keys (`customer.statusActive` etc.).

- [ ] **Step 1: Add customer keys to BOTH locales**

| key | EN | ID |
|---|---|---|
| `customer.title` | `Customer` | `Pelanggan` |
| `customer.new` | `New Customer` | `Pelanggan Baru` |
| `customer.edit` | `Edit Customer` | `Edit Pelanggan` |
| `customer.fullName` | `Full Name` | `Nama Lengkap` |
| `customer.email` | `Email` | `Email` |
| `customer.phone` | `Phone` | `Telepon` |
| `customer.idCardNumber` | `ID Card Number` | `Nomor KTP` |
| `customer.latitude` | `Latitude` | `Lintang` |
| `customer.longitude` | `Longitude` | `Bujur` |
| `customer.address` | `Address` | `Alamat` |
| `customer.billingAddress` | `Billing Address` | `Alamat Tagihan` |
| `customer.notes` | `Notes` | `Catatan` |
| `customer.serviceData` | `Service Data (JSON)` | `Data Layanan (JSON)` |
| `customer.status` | `Status` | `Status` |
| `customer.code` | `Code` | `Kode` |
| `customer.name` | `Name` | `Nama` |
| `customer.selectStatus` | `Select status` | `Pilih status` |
| `customer.add` | `Add Customer` | `Tambah Pelanggan` |
| `customer.created` | `Customer created successfully` | `Pelanggan berhasil dibuat` |
| `customer.updated` | `Customer updated successfully` | `Pelanggan berhasil diperbarui` |
| `customer.createFailed` | `Failed to create customer` | `Gagal membuat pelanggan` |
| `customer.updateFailed` | `Failed to update customer` | `Gagal memperbarui pelanggan` |
| `customer.deleted` | `Customer deleted successfully` | `Pelanggan berhasil dihapus` |
| `customer.deleteFailed` | `Failed to delete customer` | `Gagal menghapus pelanggan` |
| `customer.statusActive` | `Active` | `Aktif` |
| `customer.statusInactive` | `Inactive` | `Tidak Aktif` |
| `customer.placeholders` (name/email/phone/id/address/billing/notes/serviceData) — see step 3 |

- [ ] **Step 2: `customer-form-sheet.tsx`** — add `const { t } = useTranslation();`, then (all `label=`/`placeholder=`/`TEXT` at listed lines from the dump):
- label `Full Name` → `label={t('customer.fullName')}`, placeholder `John Doe` → `placeholder={t('customer.namePlaceholder')}` (add `customer.namePlaceholder` EN `John Doe`/ID `John Doe`)
- label `Email` → `t('customer.email')`, placeholder `john@example.com` → `t('customer.emailPlaceholder')`
- label `Phone` → `t('customer.phone')`
- label `ID Card Number` → `t('customer.idCardNumber')`, placeholder `ID card number` → `t('customer.idCardPlaceholder')`
- label `Latitude` → `t('customer.latitude')`; label `Longitude` → `t('customer.longitude')`
- label `Address` → `t('customer.address')`, placeholder `Street, city, postal code` → `t('customer.addressPlaceholder')`
- label `Billing Address` → `t('customer.billingAddress')`, placeholder `Billing address if different` → `t('customer.billingAddressPlaceholder')`
- label `Notes` → `t('customer.notes')`, placeholder `Additional notes...` → `t('customer.notesPlaceholder')`
- label `Service Data (JSON)` → `t('customer.serviceData')`, placeholder `{"pppoe_username": "user1", "plan": "100Mbps"}` → `t('customer.serviceDataPlaceholder')`
- label `Status` → `t('customer.status')`, placeholder `Select status` → `t('customer.selectStatus')`
- `Cancel` → `{t('common.cancel')}`; `Add Customer` → `{t('customer.add')}`
- toasts lines 27/31/38/41 → `t('customer.created')`, `t('customer.createFailed')`, `t('customer.updated')`, `t('customer.updateFailed')`

Placeholders table (add all):

| key | EN | ID |
|---|---|---|
| `customer.namePlaceholder` | `John Doe` | `John Doe` |
| `customer.emailPlaceholder` | `john@example.com` | `john@contoh.com` |
| `customer.idCardPlaceholder` | `ID card number` | `Nomor KTP` |
| `customer.addressPlaceholder` | `Street, city, postal code` | `Jalan, kota, kode pos` |
| `customer.billingAddressPlaceholder` | `Billing address if different` | `Alamat tagihan jika berbeda` |
| `customer.notesPlaceholder` | `Additional notes...` | `Catatan tambahan...` |
| `customer.serviceDataPlaceholder` | `{"pppoe_username": "user1", "plan": "100Mbps"}` | `{"pppoe_username": "user1", "plan": "100Mbps"}` |

- [ ] **Step 3: `customer-tables/options.tsx`** — labels become keys:

```tsx
export const STATUS_OPTIONS = [
  { value: 'active', label: 'customer.statusActive' },
  { value: 'inactive', label: 'customer.statusInactive' }
] as const;
```

- [ ] **Step 4: `customer-tables/columns.tsx`** — add `useTranslation` NOT needed (module scope). Change `title` props to keys:
- line 14: `title='Code'` → `title='customer.code'`
- line 31: `title='Name'` → `title='customer.name'`
- line 62: `title='Status'` → `title='customer.status'`
- Plain string headers `'EMAIL'`, `'PHONE'`, `'CREATED AT'` (lines 49/54/78) → convert to keys. Since they're plain strings rendered directly, replace with `header: () => <span>{...}</span>` — but `useTranslation` isn't available at module scope. Use the pattern: `header: () => <TableHeader title='customer.email' />` where `TableHeader` is a new tiny component. **Simplest compliant approach**: change them to `header: ({ column }) => <DataTableColumnHeader column={column} title='customer.email' />`. Keep `meta.label`/`placeholder` English (documented limitation).

- [ ] **Step 5: `customer-tables/cell-action.tsx`** — add hook, then:
- line 51: `Open menu` → `{t('common.openMenu')}` (add `common.openMenu` EN `Open menu`/ID `Buka menu`)
- line 56: `Actions` → `{t('table.actions')}` (already exists EN `Actions`/ID `Aksi`)
- line 58: `Update` → `{t('common.update')}` (exists)
- line 61: `Delete` → `{t('common.delete')}` (exists)
- line 30/34 toasts → `t('customer.deleted')`, `t('customer.deleteFailed')`

- [ ] **Step 6: `routes/dashboard/customers.tsx`** — add hook; `pageTitle='Customers'` → `pageTitle={t('customer.titlePlural')}` (add `customer.titlePlural` EN `Customers`/ID `Pelanggan`), `pageDescription=...` → `pageDescription={t('customer.pageDescription')}` (EN `Manage customers (React Query + search params table pattern.)` / ID `Kelola pelanggan (pola tabel React Query + search params)`).

- [ ] **Step 7: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/features/customers/ src/routes/dashboard/customers.tsx src/i18n/locales/
git commit -m "feat(i18n): translate customers feature"
```

---

### Task 5: Employees feature

**Files:**
- Modify: `src/features/employees/components/employee-form-sheet.tsx`
- Modify: `src/features/employees/components/employee-performance.tsx`
- Modify: `src/features/employees/components/employee-tables/cell-action.tsx`
- Modify: `src/features/employees/components/employee-tables/columns.tsx`
- Modify: `src/features/employees/components/employee-tables/options.tsx`
- Modify: `src/routes/dashboard/employees.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `DataTableColumnHeader` title keys, option label keys.
- Produces: `employee.*` keys.

- [ ] **Step 1: Add employee keys to BOTH locales**

| key | EN | ID |
|---|---|---|
| `employee.title` | `Employee` | `Karyawan` |
| `employee.titlePlural` | `Employees` | `Karyawan` |
| `employee.new` | `New Employee` | `Karyawan Baru` |
| `employee.edit` | `Edit Employee` | `Edit Karyawan` |
| `employee.personal` | `Personal` | `Pribadi` |
| `employee.employment` | `Employment` | `Pekerjaan` |
| `employee.salary` | `Salary` | `Gaji` |
| `employee.fullName` | `Full Name` | `Nama Lengkap` |
| `employee.nickname` | `Nickname` | `Nama Panggilan` |
| `employee.email` | `Email` | `Email` |
| `employee.phone` | `Phone` | `Telepon` |
| `employee.birthPlace` | `Birth Place` | `Tempat Lahir` |
| `employee.birthDate` | `Birth Date` | `Tanggal Lahir` |
| `employee.address` | `Address` | `Alamat` |
| `employee.idNumber` | `ID Number (KTP)` | `Nomor KTP` |
| `employee.department` | `Department` | `Departemen` |
| `employee.designation` | `Designation` | `Jabatan` |
| `employee.joinDate` | `Join Date` | `Tanggal Bergabung` |
| `employee.employmentStatus` | `Employment Status` | `Status Kepegawaian` |
| `employee.internship` | `Internship` | `Magang` |
| `employee.leaveDate` | `Leave Date` | `Tanggal Keluar` |
| `employee.baseSalary` | `Base Salary` | `Gaji Pokok` |
| `employee.status` | `Status` | `Status` |
| `employee.selectDepartment` | `Select department` | `Pilih departemen` |
| `employee.selectDesignation` | `Select designation` | `Pilih jabatan` |
| `employee.selectStatus` | `Select status` | `Pilih status` |
| `employee.add` | `Add Employee` | `Tambah Karyawan` |
| `employee.created` | `Employee created successfully` | `Karyawan berhasil dibuat` |
| `employee.updated` | `Employee updated successfully` | `Karyawan berhasil diperbarui` |
| `employee.createFailed` | `Failed to create employee` | `Gagal membuat karyawan` |
| `employee.updateFailed` | `Failed to update employee` | `Gagal memperbarui karyawan` |
| `employee.deleted` | `Employee deleted successfully` | `Karyawan berhasil dihapus` |
| `employee.deleteFailed` | `Failed to delete employee` | `Gagal menghapus karyawan` |
| `employee.performance` | `Performance Reports` | `Laporan Performa` |
| `employee.score` | `Score` | `Skor` |
| `employee.runningAverage` | `Running Average` | `Rata-rata Berjalan` |
| `employee.notes` | `Notes` | `Catatan` |
| `employee.noPerformance` | `No performance reports available.` | `Belum ada laporan performa.` |
| `employee.statusActive` | `Active` | `Aktif` |
| `employee.statusInactive` | `Inactive` | `Tidak Aktif` |
| `employee.statusProbation` | `Probation` | `Masa Percobaan` |
| `employee.statusResigned` | `Resigned` | `Mengundurkan Diri` |
| `employee.statusTerminated` | `Terminated` | `Diberhentikan` |
| `employee.pageDescription` | `Manage employees and view performance reports.` | `Kelola karyawan dan lihat laporan performa.` |
| placeholders: `employee.namePlaceholder`=`John Doe`, `employee.nicknamePlaceholder`=`Johnny`, `employee.emailPlaceholder`=`john@example.com`, `employee.cityPlaceholder`=`City`, `employee.datePlaceholder`=`YYYY-MM-DD`, `employee.addressPlaceholder`=`Street, city, postal code`, `employee.idNumberPlaceholder`=`National ID number` |

- [ ] **Step 2: `employee-form-sheet.tsx`** — add hook, then per dump:
- toasts lines 34/38/45/48 → `t('employee.created')` etc.
- line 116: `{isEdit ? 'Edit Employee' : 'New Employee'}` → `{isEdit ? t('employee.edit') : t('employee.new')}`
- line 118-119: descriptions → `{isEdit ? t('employee.editDescription') : t('employee.newDescription')}` (add `employee.editDescription` EN `Update the employee details below.`/ID `Perbarui detail karyawan di bawah ini.`, `employee.newDescription` EN `Fill in the details to create a new employee.`/ID `Isi detail untuk membuat karyawan baru.`)
- section titles `Personal`/`Employment`/`Salary` (128/173/214) → `t('employee.personal')` etc.
- all `label=`/`placeholder=` per dump lines 132-231 → mapped keys above
- line 240 `Cancel` → `t('common.cancel')`; line 282 `Add Employee` → `t('employee.add')`

- [ ] **Step 3: `employee-performance.tsx`** — add hook, then lines 21/27-30/37 → keys above.

- [ ] **Step 4: `employee-tables/options.tsx`** — labels become keys:

```tsx
export const STATUS_OPTIONS = [
  { value: 'active', label: 'employee.statusActive' },
  { value: 'inactive', label: 'employee.statusInactive' }
] as const;

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'employee.statusActive' },
  { value: 'probation', label: 'employee.statusProbation' },
  { value: 'resigned', label: 'employee.statusResigned' },
  { value: 'terminated', label: 'employee.statusTerminated' }
] as const;
```

- [ ] **Step 5: `employee-tables/columns.tsx`** — `title` props to keys: `Code`→`customer.code`, `Name`→`customer.name` (reuse existing common keys — add `common.code` EN `Code`/ID `Kode`, `common.name` EN `Name`/ID `Nama`), `Department`→`employee.department`, `Designation`→`employee.designation`, `Status`→`employee.status`. Plain string headers `'PHONE'`, `'CREATED AT'` → `DataTableColumnHeader` with keys `common.phone` (add EN `Phone`/ID `Telepon`) and `table.createdAt` (add EN `Created At`/ID `Dibuat Pada`).

- [ ] **Step 6: `employee-tables/cell-action.tsx`** — same as customer cell-action: `Open menu`→`common.openMenu`, `Actions`→`table.actions`, `Update`→`common.update`, `Delete`→`common.delete`, toasts → `employee.deleted`/`employee.deleteFailed`.

- [ ] **Step 7: `routes/dashboard/employees.tsx`** — `pageTitle='Employees'` → `t('employee.titlePlural')`, `pageDescription=...` → `t('employee.pageDescription')`.

- [ ] **Step 8: Add common keys used** — `common.code`, `common.name`, `common.phone`, `common.openMenu`, `table.actions` (exists), `table.createdAt`.

- [ ] **Step 9: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/features/employees/ src/routes/dashboard/employees.tsx src/i18n/locales/
git commit -m "feat(i18n): translate employees feature"
```

---

### Task 6: Masterdata — departments & designations

**Files:**
- Modify: `src/features/masterdata/components/department-manage-page.tsx`
- Modify: `src/features/masterdata/components/designation-manage-page.tsx`
- Modify: `src/routes/dashboard/admin/departments.tsx`
- Modify: `src/routes/dashboard/admin/designations.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `useTranslation`, `common.*`.
- Produces: `masterdata.*` keys.

- [ ] **Step 1: Add masterdata keys to BOTH locales**

| key | EN | ID |
|---|---|---|
| `masterdata.departmentsTitle` | `Departments` | `Departemen` |
| `masterdata.addDepartment` | `Add Department` | `Tambah Departemen` |
| `masterdata.noDepartments` | `No departments found` | `Tidak ada departemen` |
| `masterdata.newDepartment` | `New Department` | `Departemen Baru` |
| `masterdata.editDepartment` | `Edit Department` | `Edit Departemen` |
| `masterdata.departmentAddDescription` | `Add a new department` | `Tambah departemen baru` |
| `masterdata.departmentEditDescription` | `Update department details` | `Perbarui detail departemen` |
| `masterdata.codeRequired` | `Code *` | `Kode *` |
| `masterdata.nameRequired` | `Name *` | `Nama *` |
| `masterdata.codePlaceholder` | `e.g. ENG` | `mis. ENG` |
| `masterdata.namePlaceholder` | `e.g. Engineering` | `mis. Teknik` |
| `masterdata.description` | `Description` | `Deskripsi` |
| `masterdata.descriptionPlaceholder` | `Optional description` | `Deskripsi opsional` |
| `masterdata.nameAndCodeRequired` | `Name and code are required` | `Nama dan kode wajib diisi` |
| `masterdata.departmentCreated` | `Department created` | `Departemen dibuat` |
| `masterdata.departmentUpdated` | `Department updated` | `Departemen diperbarui` |
| `masterdata.departmentDeleted` | `Department deleted` | `Departemen dihapus` |
| `masterdata.departmentCreateFailed` | `Failed to create department` | `Gagal membuat departemen` |
| `masterdata.departmentUpdateFailed` | `Failed to update department` | `Gagal memperbarui departemen` |
| `masterdata.departmentDeleteFailed` | `Failed to delete department` | `Gagal menghapus departemen` |
| `masterdata.deleteDepartmentConfirm` | `Delete this department?` | `Hapus departemen ini?` |
| `masterdata.jobTitlesTitle` | `Job Titles / Designations` | `Jabatan / Posisi` |
| `masterdata.addJobTitle` | `Add Job Title` | `Tambah Jabatan` |
| `masterdata.noJobTitles` | `No job titles found` | `Tidak ada jabatan` |
| `masterdata.newJobTitle` | `New Job Title` | `Jabatan Baru` |
| `masterdata.editJobTitle` | `Edit Job Title` | `Edit Jabatan` |
| `masterdata.jobTitleAddDescription` | `Add a new job title` | `Tambah jabatan baru` |
| `masterdata.jobTitleEditDescription` | `Update job title details` | `Perbarui detail jabatan` |
| `masterdata.department` | `Department` | `Departemen` |
| `masterdata.baseSalaryRp` | `Base Salary (Rp)` | `Gaji Pokok (Rp)` |
| `masterdata.baseSalaryPlaceholder` | `Optional base salary` | `Gaji pokok opsional` |
| `masterdata.noDepartment` | `No department` | `Tanpa departemen` |
| `masterdata.designationCreated` | `Designation created` | `Jabatan dibuat` |
| `masterdata.designationUpdated` | `Designation updated` | `Jabatan diperbarui` |
| `masterdata.designationDeleted` | `Designation deleted` | `Jabatan dihapus` |
| `masterdata.designationCreateFailed` | `Failed to create designation` | `Gagal membuat jabatan` |
| `masterdata.designationUpdateFailed` | `Failed to update designation` | `Gagal memperbarui jabatan` |
| `masterdata.designationDeleteFailed` | `Failed to delete designation` | `Gagal menghapus jabatan` |
| `masterdata.deleteDesignationConfirm` | `Delete this designation?` | `Hapus jabatan ini?` |
| `masterdata.departmentsPageTitle` | `Department Management` | `Manajemen Departemen` |
| `masterdata.departmentsPageDescription` | `Add, edit, and manage company departments` | `Tambah, edit, dan kelola departemen perusahaan` |
| `masterdata.jobTitlesPageTitle` | `Job Title Management` | `Manajemen Jabatan` |
| `masterdata.jobTitlesPageDescription` | `Add, edit, and manage job titles/designations` | `Tambah, edit, dan kelola jabatan/posisi` |

- [ ] **Step 2: `department-manage-page.tsx`** — add hook, then:
- toasts lines 55/59/62/77/81/84/91/94/97 → keys above (`res?.message` fallbacks: `t('masterdata.departmentCreateFailed')` etc.)
- line 126: `Departments` → `{t('masterdata.departmentsTitle')}`
- line 129: `Add Department` → `{t('masterdata.addDepartment')}`
- line 139: `No departments found` → `{t('masterdata.noDepartments')}`
- lines 145-149 table heads: `Code`→`common.code`, `Name`→`common.name`, `Description`→`masterdata.description`, `Status`→`common.status`, `Actions`→`table.actions`
- line 162: `{dept.is_active ? 'Active' : 'Inactive'}` → `{dept.is_active ? t('common.active') : t('common.inactive')}` (add `common.active` EN `Active`/ID `Aktif`, `common.inactive` EN `Inactive`/ID `Tidak Aktif`)
- line 174: `confirm('Delete this department?')` → `confirm(t('masterdata.deleteDepartmentConfirm'))`
- line 194-197: dialog title/desc → `masterdata.editDepartment`/`masterdata.newDepartment` + descriptions
- lines 201-219: labels/placeholders → keys
- line 227: `Cancel` → `t('common.cancel')`
- line 232: toast `Name and code are required` → `t('masterdata.nameAndCodeRequired')`
- line 248: `{isEdit ? 'Update' : 'Create'}` → `{isEdit ? t('common.update') : t('common.create')}`

- [ ] **Step 3: `designation-manage-page.tsx`** — same treatment, per dump lines 175-321 (title 175, add 178, empty 188, heads 194-199, dialog labels 265-313, cancel 321, toasts 95/102/119/126/133/139/326).

- [ ] **Step 4: route pages** — `admin/departments.tsx` pageTitle/Description → `masterdata.departmentsPageTitle`/`...Description`; `admin/designations.tsx` → `masterdata.jobTitlesPageTitle`/`...Description`.

- [ ] **Step 5: Add common keys** — `common.active`, `common.inactive` (if not present).

- [ ] **Step 6: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/features/masterdata/ src/routes/dashboard/admin/ src/i18n/locales/
git commit -m "feat(i18n): translate masterdata pages"
```

---

### Task 7: Overview / Dashboard

**Files:**
- Modify: `src/features/overview/components/overview.tsx`
- Modify: `src/features/overview/components/area-graph.tsx`
- Modify: `src/features/overview/components/bar-graph.tsx`
- Modify: `src/features/overview/components/pie-graph.tsx`
- Modify: `src/features/overview/components/recent-sales.tsx`
- Modify: `src/routes/dashboard/overview.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `useTranslation`.
- Produces: extended `overview.*` keys.

- [ ] **Step 1: Add overview keys to BOTH locales** (extend existing `overview` block)

| key | EN | ID |
|---|---|---|
| `overview.welcome` | `Hi, Welcome back 👋` | `Hai, Selamat datang kembali 👋` |
| `overview.download` | `Download` | `Unduh` |
| `overview.overviewTab` | `Overview` | `Ringkasan` |
| `overview.analyticsTab` | `Analytics` | `Analitik` |
| `overview.newCustomers` | `New Customers` | `Pelanggan Baru` |
| `overview.activeAccounts` | `Active Accounts` | `Akun Aktif` |
| `overview.growthRate` | `Growth Rate` | `Tingkat Pertumbuhan` |
| `overview.trendingUpMonth` | `Trending up this month` | `Meningkat bulan ini` |
| `overview.visitorsLast6Months` | `Visitors for the last 6 months` | `Pengunjung 6 bulan terakhir` |
| `overview.down20Period` | `Down 20% this period` | `Turun 20% periode ini` |
| `overview.acquisitionAttention` | `Acquisition needs attention` | `Akuisisi perlu perhatian` |
| `overview.strongRetention` | `Strong user retention` | `Retensi pengguna kuat` |
| `overview.engagementTargets` | `Engagement exceed targets` | `Keterlibatan melampaui target` |
| `overview.steadyIncrease` | `Steady performance increase` | `Peningkatan performa stabil` |
| `overview.meetsGrowthProjections` | `Meets growth projections` | `Memenuhi proyeksi pertumbuhan` |
| `overview.areaChartTitle` | `Dotted Area Chart` | `Grafik Area Titik` |
| `overview.areaChartSubtitle` | `Showing total visitors for the last 6 months` | `Menampilkan total pengunjung 6 bulan terakhir` |
| `overview.barChartTitle` | `Bar Chart - Multiple` | `Grafik Batang - Ganda` |
| `overview.barChartSubtitle` | `January - June 2025` | `Januari - Juni 2025` |
| `overview.pieChartTitle` | `Pie Chart` | `Grafik Lingkaran` |
| `overview.pieChartSubtitle` | `January - June 2024` | `Januari - Juni 2024` |
| `overview.recentSales` | `Recent Sales` | `Penjualan Terbaru` |
| `overview.salesThisMonth` | `You made 265 sales this month.` | `Anda membuat 265 penjualan bulan ini.` |

- [ ] **Step 2: `overview.tsx`** — add hook, then per dump lines 24-115 → keys above (skip numeric `$1,250.00` values — keep as-is).

- [ ] **Step 3: `area-graph.tsx`** — add hook; lines 45/51 → `overview.areaChartTitle`/`overview.areaChartSubtitle`.

- [ ] **Step 4: `bar-graph.tsx`** — add hook; lines 38/44 → `overview.barChartTitle`/`overview.barChartSubtitle`.

- [ ] **Step 5: `pie-graph.tsx`** — add hook; lines 52/58 → `overview.pieChartTitle`/`overview.pieChartSubtitle`.

- [ ] **Step 6: `recent-sales.tsx`** — add hook; lines 46/47 → `overview.recentSales`/`overview.salesThisMonth`.

- [ ] **Step 7: `routes/dashboard/overview.tsx`** — add hook; lines 38-118 → same keys as overview.tsx.

- [ ] **Step 8: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/features/overview/ src/routes/dashboard/overview.tsx src/i18n/locales/
git commit -m "feat(i18n): translate overview/dashboard"
```

---

### Task 8: Tasks feature

**Files:**
- Modify: `src/features/tasks/components/jobs-page.tsx`
- Modify: `src/features/tasks/components/my-work-page.tsx`
- Modify: `src/features/tasks/components/my-work-section.tsx`
- Modify: `src/features/tasks/components/available-jobs-section.tsx`
- Modify: `src/features/tasks/components/not-available-section.tsx`
- Modify: `src/features/tasks/components/task-detail-sheet.tsx`
- Modify: `src/features/tasks/api/hooks.ts`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `useTranslation` (works in hooks too — `useTakeTask`/`useCompleteTask` are React hooks).
- Produces: `task.*` keys.

- [ ] **Step 1: Add task keys to BOTH locales**

| key | EN | ID |
|---|---|---|
| `task.availableJobs` | `Available Jobs` | `Pekerjaan Tersedia` |
| `task.availableJobsCount` | `Available Jobs ({{count}})` | `Pekerjaan Tersedia ({{count}})` |
| `task.seeAll` | `See all` | `Lihat semua` |
| `task.noJobsAvailable` | `No jobs available right now — check back later` | `Belum ada pekerjaan — periksa lagi nanti` |
| `task.clearFilters` | `Clear filters` | `Hapus filter` |
| `task.location` | `Location` | `Lokasi` |
| `task.allLocations` | `All locations` | `Semua lokasi` |
| `task.priority` | `Priority` | `Prioritas` |
| `task.allPriorities` | `All priorities` | `Semua prioritas` |
| `task.low` | `Low` | `Rendah` |
| `task.medium` | `Medium` | `Sedang` |
| `task.high` | `High` | `Tinggi` |
| `task.taking` | `Taking…` | `Mengambil…` |
| `task.takeTask` | `Take Task` | `Ambil Pekerjaan` |
| `task.inProgressCount` | `In Progress ({{count}})` | `Sedang Berjalan ({{count}})` |
| `task.nothingInProgress` | `Nothing in progress` | `Tidak ada yang sedang berjalan` |
| `task.open` | `Open` | `Buka` |
| `task.assignedCount` | `Assigned ({{count}})` | `Ditugaskan ({{count}})` |
| `task.noAssignedTasks` | `No assigned tasks` | `Tidak ada tugas ditugaskan` |
| `task.myWork` | `My Work` | `Pekerjaan Saya` |
| `task.notAvailableCount` | `Not available for you ({{count}})` | `Tidak tersedia untuk Anda ({{count}})` |
| `task.markComplete` | `Mark Complete` | `Tandai Selesai` |
| `task.openMyWork` | `Open My Work` | `Buka Pekerjaan Saya` |
| `task.taken` | `Task taken` | `Tugas diambil` |
| `task.takeFailed` | `Failed to take task` | `Gagal mengambil tugas` |
| `task.completed` | `Task completed` | `Tugas selesai` |
| `task.completeFailed` | `Failed to complete task` | `Gagal menyelesaikan tugas` |

- [ ] **Step 2: `jobs-page.tsx`** — add hook, then per dump:
- line 38: `Available Jobs ({tasks.length})` → `{t('task.availableJobsCount', { count: tasks.length })}`
- line 40: `Clear filters` → `{t('task.clearFilters')}`
- line 54: `placeholder='Location'` → `placeholder={t('task.location')}`
- line 57: `All locations` → `{t('task.allLocations')}`
- line 75: `placeholder='Priority'` → `placeholder={t('task.priority')}`
- line 78: `All priorities` → `{t('task.allPriorities')}`
- lines 79-81: `Low`/`Medium`/`High` → `t('task.low')` etc.
- line 91: no-jobs text → `t('task.noJobsAvailable')`
- line 106: `{takeTask.isPending ? 'Taking…' : 'Take Task'}` → `{takeTask.isPending ? t('task.taking') : t('task.takeTask')}`

- [ ] **Step 3: `my-work-page.tsx`** — add hook:
- line 21: `In Progress ({inProgress.length})` → `{t('task.inProgressCount', { count: inProgress.length })}`
- line 23: `Nothing in progress` → `{t('task.nothingInProgress')}`
- lines 37, 62: `Open` → `{t('task.open')}`
- line 46: `Assigned ({assigned.length})` → `{t('task.assignedCount', { count: assigned.length })}`
- line 48: `No assigned tasks` → `{t('task.noAssignedTasks')}`

- [ ] **Step 4: `my-work-section.tsx`** — add hook: line 18 `My Work`→`t('task.myWork')`, line 20 `See all`→`t('task.seeAll')`, line 24 `No assigned tasks`→`t('task.noAssignedTasks')`, line 38 `Open`→`t('task.open')`.

- [ ] **Step 5: `available-jobs-section.tsx`** — add hook: line 18 `Available Jobs`→`t('task.availableJobs')`, line 20 `See all`→`t('task.seeAll')`, line 25 `No jobs...`→`t('task.noJobsAvailable')`.

- [ ] **Step 6: `not-available-section.tsx`** — add hook: line 20 `Not available for you ({count})` → `t('task.notAvailableCount', { count })` (check actual expression shape at line 20 and interpolate `count`).

- [ ] **Step 7: `task-detail-sheet.tsx`** — add hook: line 74 `Take Task`→`t('task.takeTask')`, line 89 `Mark Complete`→`t('task.markComplete')`, line 95 `Open My Work`→`t('task.openMyWork')`.

- [ ] **Step 8: `api/hooks.ts`** — add `useTranslation` inside each hook:

```ts
export function useTakeTask() {
  const { t } = useTranslation();
  // line 12: toast.success('Task taken') → toast.success(t('task.taken'))
  // line 15: toast.error(res?.message ?? 'Failed to take task') → toast.error(res?.message ?? t('task.takeFailed'))
  // line 19: toast.error('Failed to take task') → toast.error(t('task.takeFailed'))
}
export function useCompleteTask() {
  const { t } = useTranslation();
  // lines 30/33/37 → t('task.completed') / t('task.completeFailed')
}
```

- [ ] **Step 9: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/features/tasks/ src/i18n/locales/
git commit -m "feat(i18n): translate tasks feature"
```

---

### Task 9: Notifications, Audit, Profile

**Files:**
- Modify: `src/features/notifications/components/notification-center.tsx`
- Modify: `src/features/notifications/components/notifications-page.tsx`
- Modify: `src/features/audit/components/audit-log-page.tsx`
- Modify: `src/features/profile/components/profile-page.tsx`
- Modify: `src/routes/dashboard/admin/audit-log.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `useTranslation`.
- Produces: `audit.*`, `profile.*`, extended `notifications.*`.

- [ ] **Step 1: Add keys to BOTH locales**

| key | EN | ID |
|---|---|---|
| `notifications.newCount` | `{{count}} new` | `{{count}} baru` |
| `notifications.noNotificationsPage` | `No notifications` | `Tidak ada notifikasi` |
| `notifications.pageTitle` | `Notifications` | `Notifikasi` |
| `notifications.pageDescription` | `View and manage all your notifications.` | `Lihat dan kelola semua notifikasi Anda.` |
| `notifications.allCount` | `All ({{count}})` | `Semua ({{count}})` |
| `notifications.unreadCount` | `Unread ({{count}})` | `Belum dibaca ({{count}})` |
| `notifications.readCount` | `Read ({{count}})` | `Dibaca ({{count}})` |
| `audit.pageTitle` | `Audit Log` | `Log Audit` |
| `audit.pageDescription` | `Record of administrative actions (who changed what and when)` | `Catatan aksi administratif (siapa mengubah apa dan kapan)` |
| `audit.filterByAction` | `Filter by action (e.g. employee.create)` | `Filter berdasarkan aksi (mis. employee.create)` |
| `audit.recordedActions` | `{{count}} recorded action(s)` | `{{count}} aksi tercatat` |
| `audit.time` | `Time` | `Waktu` |
| `audit.actor` | `Actor` | `Pelaku` |
| `audit.action` | `Action` | `Aksi` |
| `audit.entity` | `Entity` | `Entitas` |
| `audit.id` | `ID` | `ID` |
| `audit.noEntries` | `No audit entries yet.` | `Belum ada entri audit.` |
| `profile.thisMonth` | `This month` | `Bulan ini` |
| `profile.present` | `Present` | `Hadir` |
| `profile.late` | `Late` | `Terlambat` |
| `profile.absent` | `Absent` | `Absen` |
| `profile.activeTasks` | `Active tasks` | `Tugas aktif` |
| `profile.notifications` | `Notifications` | `Notifikasi` |
| `profile.signOut` | `Sign out` | `Keluar` |

- [ ] **Step 2: `notification-center.tsx`** — add hook:
- line 44: `sr-only Notifications` → `{t('notifications.title')}` (exists)
- line 50: `Notifications` → `{t('notifications.title')}`
- line 56: `{count} new` → `{t('notifications.newCount', { count })}`
- line 66: `Mark all as read` → `{t('notifications.markAllAsRead')}`
- line 76: `No notifications yet` → `{t('notifications.noNotifications')}` (exists)

- [ ] **Step 3: `notifications-page.tsx`** — add hook:
- line 37: `No notifications` → `{t('notifications.noNotificationsPage')}`
- line 69: `pageTitle='Notifications'` → `pageTitle={t('notifications.pageTitle')}`
- line 70: `pageDescription='View and manage all your notifications.'` → `pageDescription={t('notifications.pageDescription')}`
- line 74: `Mark all as read` → `{t('notifications.markAllAsRead')}`
- lines 81-83: `All ({...})`/`Unread ({...})`/`Read ({...})` → `t('notifications.allCount', { count: notifications.length })` etc.

- [ ] **Step 4: `audit-log-page.tsx`** — add hook, then per dump lines 25/32/37-41/59 → `audit.*` keys.

- [ ] **Step 5: `profile-page.tsx`** — add hook, then per dump lines 56-92 → `profile.*` keys (56 `This month`, 60 `Present`, 64 `Late`, 68 `Absent`, 72 `Active tasks`, 83 `Notifications`, 92 `Sign out`).

- [ ] **Step 6: `routes/dashboard/admin/audit-log.tsx`** — pageTitle/Description → `audit.pageTitle`/`audit.pageDescription`.

- [ ] **Step 7: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/features/notifications/ src/features/audit/ src/features/profile/ src/routes/dashboard/admin/audit-log.tsx src/i18n/locales/
git commit -m "feat(i18n): translate notifications, audit, profile"
```

---

### Task 10: Products & Users & Role Groups — remaining strings

**Files:**
- Modify: `src/features/products/components/product-form.tsx`
- Modify: `src/features/products/components/product-view-page.tsx`
- Modify: `src/features/products/components/product-tables/cell-action.tsx`
- Modify: `src/features/products/components/product-tables/columns.tsx`
- Modify: `src/features/products/components/product-tables/options.tsx`
- Modify: `src/features/users/components/users-table/cell-action.tsx`
- Modify: `src/features/users/components/users-table/columns.tsx`
- Modify: `src/features/users/components/users-table/options.tsx`
- Modify: `src/features/role-groups/components/role-group-form-sheet.tsx`
- Modify: `src/routes/dashboard/product/index.tsx`
- Modify: `src/routes/dashboard/users.tsx`
- Modify: `src/routes/dashboard/admin/role-groups/index.tsx`
- Modify: `src/routes/dashboard/admin/role-groups/$id.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `DataTableColumnHeader` title keys, option label keys, `useTranslation`.
- Produces: extended `product.*`, `user.*`, `roleGroups.*` keys.

- [ ] **Step 1: Add/extend keys in BOTH locales**

`product` (extend):
| key | EN | ID |
|---|---|---|
| `product.addNew` | `Add New` | `Tambah Baru` |
| `product.back` | `Back` | `Kembali` |
| `product.deleted` | `Product deleted successfully` | `Produk berhasil dihapus` |
| `product.deleteFailed` | `Failed to delete product` | `Gagal menghapus produk` |
| `product.pageDescription` | `Manage products (React Query + search params table pattern.)` | `Kelola produk (pola tabel React Query + search params)` |
| `product.categoryElectronics` | `Electronics` | `Elektronik` |
| `product.categoryFurniture` | `Furniture` | `Furnitur` |
| `product.categoryClothing` | `Clothing` | `Pakaian` |
| `product.categoryToys` | `Toys` | `Mainan` |
| `product.categoryGroceries` | `Groceries` | `Sembako` |
| `product.categoryBooks` | `Books` | `Buku` |
| `product.categoryJewelry` | `Jewelry` | `Perhiasan` |
| `product.categoryBeauty` | `Beauty Products` | `Produk Kecantikan` |

`user` (extend):
| key | EN | ID |
|---|---|---|
| `user.deleted` | `User deleted successfully` | `Pengguna berhasil dihapus` |
| `user.deleteFailed` | `Failed to delete user` | `Gagal menghapus pengguna` |
| `user.statusActive` | `Active` | `Aktif` |
| `user.statusInactive` | `Inactive` | `Tidak Aktif` |
| `user.statusInvited` | `Invited` | `Diundang` |
| `user.roleAdmin` | `Admin` | `Admin` |
| `user.roleHr` | `HR` | `HR` |
| `user.roleEmployee` | `Employee` | `Karyawan` |
| `user.roleTechnician` | `Technician` | `Teknisi` |
| `user.pageDescription` | `Manage users (React Query + search params table pattern.)` | `Kelola pengguna (pola tabel React Query + search params)` |
| `user.searchPlaceholder` | `Search users...` | `Cari pengguna...` |

`roleGroups` (extend):
| key | EN | ID |
|---|---|---|
| `roleGroups.roleName` | `Role Name` | `Nama Peran` |
| `roleGroups.roleNamePlaceholder` | `Technician` | `Teknisi` |
| `roleGroups.descriptionPlaceholder` | `Field technician role` | `Peran teknisi lapangan` |
| `roleGroups.fullAdminAccess` | `Full Admin Access` | `Akses Admin Penuh` |
| `roleGroups.adminAccessDescription` | `Grants automatic access to all modules` | `Memberikan akses otomatis ke semua modul` |
| `roleGroups.addRole` | `Add Role` | `Tambah Peran` |
| `roleGroups.editRole` | `Edit Role` | `Edit Peran` |
| `roleGroups.newRole` | `New Role` | `Peran Baru` |
| `roleGroups.created` | `Role group created` | `Grup peran dibuat` |
| `roleGroups.updated` | `Role group updated` | `Grup peran diperbarui` |
| `roleGroups.createFailed` | `Failed to create role group` | `Gagal membuat grup peran` |
| `roleGroups.updateFailed` | `Failed to update role group` | `Gagal memperbarui grup peran` |
| `roleGroups.permissionsPageTitle` | `Role Permissions` | `Izin Peran` |
| `roleGroups.permissionsPageDescription` | `Configure which modules and actions this role can access` | `Atur modul dan aksi apa saja yang dapat diakses peran ini` |
| `roleGroups.pageDescription` | `Manage role groups and configure module-level access permissions` | `Kelola grup peran dan atur izin akses tingkat modul` |

- [ ] **Step 2: `product-form.tsx`** — add hook: labels/placeholders lines 88-125 → existing `product.*` keys; line 135 `Back` → `{t('common.back')}`; toasts lines 27/31/39/43 → existing `product.created`/`product.createFailed`/`product.updated`/`product.updateFailed`.

- [ ] **Step 3: `product-view-page.tsx`** — add hook: line 13 `pageTitle='Create New Product'` → `pageTitle={t('product.createNew')}`, line 26 `pageTitle='Edit Product'` → `pageTitle={t('product.edit')}`.

- [ ] **Step 4: `product-tables/cell-action.tsx`** — add hook: `Open menu`→`common.openMenu`, `Actions`→`table.actions`, `Update`→`common.update`, `Delete`→`common.delete`, toasts → `product.deleted`/`product.deleteFailed`.

- [ ] **Step 5: `product-tables/columns.tsx`** — `title='Name'` → `'common.name'`, `title='Category'` → `'product.category'`; plain headers `'IMAGE'`/`'PRICE'`/`'DESCRIPTION'` → `DataTableColumnHeader` with keys `product.image` (EN `Image`/ID `Gambar`), `product.price` (exists), `product.description` (exists).

- [ ] **Step 6: `product-tables/options.tsx`** — `label` → keys `product.categoryElectronics` etc.

- [ ] **Step 7: `users-table/cell-action.tsx`** — same as product cell-action, toasts → `user.deleted`/`user.deleteFailed`.

- [ ] **Step 8: `users-table/columns.tsx`** — `title='Name'` → `'common.name'`, `title='Role'` → `'user.role'`; plain header `'STATUS'` → `DataTableColumnHeader` with `'user.status'`; `meta.label: 'Name'`/`'roles'` stay (documented limitation), but `meta.placeholder: 'Search users...'` → leave English per spec (documented).

- [ ] **Step 9: `users-table/options.tsx`** — labels → `user.roleAdmin` etc.; `user.statusActive`/`user.statusInactive`/`user.statusInvited`.

- [ ] **Step 10: `role-group-form-sheet.tsx`** — add hook: lines 115-182 per dump → `roleGroups.*` keys; toasts lines 41/44/51/54 → `roleGroups.created`/`createFailed`/`updated`/`updateFailed`; line 165 `Cancel` → `common.cancel`.

- [ ] **Step 11: route pages** — `dashboard/product/index.tsx`: `pageTitle='Products'` → `t('product.titlePlural')` (add EN `Products`/ID `Produk`), `pageDescription` → `product.pageDescription`, `Add New` → `t('product.addNew')`. `dashboard/users.tsx`: `pageTitle='Users'` → `t('user.titlePlural')` (add EN `Users`/ID `Pengguna`), `pageDescription` → `user.pageDescription`. `admin/role-groups/index.tsx`: `pageTitle='Role Groups'` → `t('roleGroups.title')` (exists), `pageDescription` → `roleGroups.pageDescription`. `admin/role-groups/$id.tsx`: `pageTitle='Role Permissions'` → `t('roleGroups.permissionsPageTitle')`, `pageDescription` → `roleGroups.permissionsPageDescription`.

- [ ] **Step 12: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/features/products/ src/features/users/ src/features/role-groups/ src/routes/dashboard/product/ src/routes/dashboard/users.tsx src/routes/dashboard/admin/role-groups/ src/i18n/locales/
git commit -m "feat(i18n): translate products, users, role groups"
```

---

### Task 11: Navigation, layout, and shared chrome

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/components/layout/bottom-nav.tsx`
- Modify: `src/components/layout/mobile-header.tsx`
- Modify: `src/components/search-input.tsx`
- Modify: `src/hooks/use-breadcrumbs.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`

**Notes:** `src/components/layout/header.tsx` and `src/components/layout/mobile-shell.tsx` render no user-facing strings — do not modify them. The `app-sidebar` brand text ("TanStack Start" / "Dashboard", lines 50-51) is a product name — keep "TanStack Start" hardcoded, translate "Dashboard" via `t('navigation.dashboard')`.

**Interfaces:**
- Consumes: `useTranslation`.
- Produces: extended `navigation.*` keys.

- [ ] **Step 1: Add navigation keys to BOTH locales** (extend existing `navigation` block)

| key | EN | ID |
|---|---|---|
| `navigation.home` | `Home` | `Beranda` |
| `navigation.myWork` | `My Work` | `Pekerjaan Saya` |
| `navigation.attendance` | `Attendance` | `Absensi` |
| `navigation.leave` | `Leave` | `Cuti` |
| `navigation.profile` | `Profile` | `Profil` |
| `navigation.management` | `Management` | `Manajemen` |
| `navigation.customers` | `Customers` | `Pelanggan` |
| `navigation.employees` | `Employees` | `Karyawan` |
| `navigation.settings` | `Settings` | `Pengaturan` |
| `navigation.departments` | `Departments` | `Departemen` |
| `navigation.jobTitles` | `Job Titles` | `Jabatan` |
| `navigation.auditLog` | `Audit Log` | `Log Audit` |
| `navigation.goToAttendance` | `Go to attendance` | `Ke absensi` |

- [ ] **Step 2: `bottom-nav.tsx`** — add hook; change `navItems` to carry keys:

```tsx
const navItems = [
  { icon: Icons.dashboard, labelKey: 'navigation.home', to: '/dashboard/overview' },
  { icon: Icons.workspace, labelKey: 'navigation.myWork', to: '/dashboard/my-work' },
  { icon: Icons.calendar, labelKey: 'navigation.leave', to: '/dashboard/leave' },
  { icon: Icons.user, labelKey: 'navigation.profile', to: '/dashboard/profile' }
] as const;
// line 25: aria-label='Go to attendance' → aria-label={t('navigation.goToAttendance')}
// line 60: {item.label} → {t(item.labelKey)}
```

- [ ] **Step 3: `mobile-header.tsx`** — add hook:
- line 33-35: greetings → `t('navigation.goodMorning')`/`goodAfternoon`/`goodEvening` (add keys EN `Good morning`/`Good afternoon`/`Good evening`, ID `Selamat pagi`/`Selamat siang`/`Selamat malam`)
- line 82: `Sign out` → `{t('common.signOut')}` (add `common.signOut` EN `Sign out`/ID `Keluar`)

- [ ] **Step 5: `search-input.tsx`** — add hook; line "Search..." → `{t('common.search')}` (key exists, EN `Search`/ID `Cari`).

- [ ] **Step 6: `use-breadcrumbs.tsx`** — translate breadcrumb titles

Add a segment→key map in the hook so generated titles translate:

```tsx
const segmentKeys: Record<string, string> = {
  dashboard: 'navigation.dashboard',
  overview: 'navigation.overview',
  product: 'navigation.product',
  customers: 'navigation.customers',
  employees: 'navigation.employees',
  users: 'navigation.users',
  attendance: 'navigation.attendance',
  leave: 'navigation.leave',
  profile: 'navigation.profile',
  admin: 'navigation.settings',
  departments: 'navigation.departments',
  designations: 'navigation.jobTitles',
  'audit-log': 'navigation.auditLog',
  'role-groups': 'navigation.roleGroups'
};
```

In the fallback path, replace `title: segment.charAt(0).toUpperCase() + segment.slice(1)` with a `t()`-based title: translate the mapped key if present, else keep the capitalized segment. Since `useBreadcrumbs` is a hook, call `useTranslation()` inside it and apply `t(segmentKeys[segment] ?? capitalizedSegment)`. The `routeMapping` entries (`'Dashboard'`, `'Employee'`, `'Product'`) also route through `t()` — map them the same way.

- [ ] **Step 7: `app-sidebar.tsx`** — add hook; translate nav titles and group labels via key lookup:

```tsx
const { t } = useTranslation();
// line 51: <span className='text-muted-foreground truncate text-xs'>Dashboard</span> → {t('navigation.dashboard')}
// line 61: <SidebarGroupLabel>{group.label}</SidebarGroupLabel> → <SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
// line 74/99: tooltip={item.title} → tooltip={t(item.title)}
// line 76: <span>{item.title}</span> → <span>{t(item.title)}</span>
// line 86: <span>{subItem.title}</span> → <span>{t(subItem.title)}</span>
// line 104: <span>{item.title}</span> → <span>{t(item.title)}</span>
```

Add keys `navigation.overview` (exists), `navigation.dashboard` (exists), and the new ones from Step 1 so every `navGroups` title resolves (Overview, Dashboard, My Work, Attendance, Leave, Profile, Management, Product, Customers, Employees, Settings, Users, Departments, Job Titles, Audit Log, Role Groups — all now present in `navigation.*`).

- [ ] **Step 8: Verify + commit**

Run: `bun run i18n:check`, `bun run typecheck` — pass.
```bash
git add src/components/layout/ src/i18n/locales/
git commit -m "feat(i18n): translate navigation and layout chrome"
```

---

### Task 12: Regenerate baseline & final verification

**Files:**
- Modify: `scripts/i18n-hardcoded-baseline.txt` (regenerated)

- [ ] **Step 1: Regenerate the hardcoded-string baseline**

Run: `bun run i18n:baseline`
Expected: `Baseline written: N entries -> scripts/i18n-hardcoded-baseline.txt` where N is the remaining count (legal pages + intentionally skipped strings).

- [ ] **Step 2: Inspect remaining baseline entries**

Run: `cut -d: -f1 scripts/i18n-hardcoded-baseline.txt | sort | uniq -c | sort -rn`
Expected: entries are concentrated in `terms-of-service.tsx`, `privacy-policy.tsx`, `about.tsx` (legal pages, intentionally excluded). Any other files present are intentional gaps (e.g. `meta.label`/`meta.placeholder` in columns files were never flagged since they're JS object literals, not JSX attrs).

- [ ] **Step 3: Full verification**

```bash
bun run i18n:check          # key parity OK
bun run i18n:hardcoded      # OK (only baseline entries)
bun run typecheck           # no errors
bun run lint                # no errors
bun run test                # all pass
```

- [ ] **Step 4: Manual smoke test**

1. `bun run dev` → open `http://localhost:3000`
2. Sign in with `admin@example.com` / `Password123!`
3. Click the globe in the header → select `ID`
4. Verify: sidebar nav, overview cards, tables (headers), toasts, forms (employee/customer), pagination text, dropdowns all render Indonesian
5. Hard-refresh the page → language stays Indonesian (cookie persisted)
6. Switch back to `EN` → everything reverts to English

- [ ] **Step 5: Update docs**

Append a note to `docs/CHANGELOG.md` under a new `## [Unreleased]` section: full i18n migration (all functional UI translatable EN/ID, persistence fix, codebase remains English-only).

- [ ] **Step 6: Commit**

```bash
git add scripts/i18n-hardcoded-baseline.txt docs/CHANGELOG.md
git commit -m "chore(i18n): regenerate baseline after full migration"
```

---

## Self-Review Notes

- **Spec coverage**: persistence fix (Task 1 S1), `<html lang>` (Task 1 S1), string migration per feature (Tasks 2-10), header-only columns approach (Tasks 1/4/5/10 title keys), option labelKeys (Tasks 1/4/5/10), toasts everywhere, legal pages excluded (never touched), server errors excluded (never touched), baseline regen + verification (Task 12). ✅
- **Type consistency**: `DataTableColumnHeader` accepts `title: string` (unchanged signature — now a key); option arrays keep `{ value, label }` shape with `label` now holding a key; `statusFilters` gains `labelKey` (Task 3 S4) — only used inside `leave-history.tsx`. `t('table.rowsSelected', { selected, total })` names match i18next interpolation `{{selected}}/{{total}}`.
- **Plural keys**: `attendance.dayCount`/`dayCountPlural` use i18next count pluralization; `task.*Count` keys use explicit interpolation.
- **Intentionally left in baseline (technical props, not user-facing)**: `side=`/`align=`/`defaultValue=`/`dataKey=`/`fill=`/`stroke=`/`stackId=`/`patternUnits=`/`attribute=`/`defaultTheme=`/`position=`/`buttonPosition=` in `src/routes/dashboard.tsx`, `src/routes/__root.tsx`, `area-graph.tsx`, `bar-graph.tsx`, `pie-graph.tsx` — the scanner flags them but they are NOT translatable text; they remain in the baseline. Do not convert them.
- Legal pages `about.tsx`/`privacy-policy.tsx`/`terms-of-service.tsx` are never modified; their entries remain in the baseline.
