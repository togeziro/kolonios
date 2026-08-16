# Open Tickets Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/dashboard/jobs/` page to match the Stitch "Open Tickets" mobile design with filter chips, creator info, and Take button.

**Architecture:** Modify the existing `jobs-page.tsx` to replace Select dropdowns with horizontal filter chips and restyle ticket cards. Add a LEFT JOIN on the user table in `listOpenTickets` to include creator names. Keep the existing route and server function signatures.

**Tech Stack:** TanStack Router (search params), TanStack React Query, React i18next, shadcn UI primitives, Tailwind CSS

## Global Constraints

- Dark mode first (zinc-950 bg, zinc-900 cards, zinc-800 borders)
- Inter font family
- `rounded-2xl` cards, `rounded-full` badges
- i18n en/id for every new string
- No new dependencies
- Existing tests must pass (`bun run test:run`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/db/tickets.ts:226-261` | Modify | Add LEFT JOIN on `user` for creator name in `listOpenTickets` |
| `src/features/tickets/api/types.ts:21-44` | Modify | Add `createdByName`, `createdAt` to `Ticket` type |
| `src/features/tickets/components/jobs-page.tsx` | Rewrite | Filter chips, new card layout, Take button, empty state |
| `locales/en.json` | Modify | Add i18n keys for Open Tickets screen |
| `locales/id.json` | Modify | Add i18n keys for Open Tickets screen |
| `src/features/tickets/components/jobs-page.test.tsx` | Create/Update | Tests for chips, cards, Take flow |

---

### Task 1: Add creator name to `Ticket` type and `listOpenTickets`

**Files:**
- Modify: `src/features/tickets/api/types.ts:21-44`
- Modify: `src/lib/db/tickets.ts:70-99` (toTicket function)
- Modify: `src/lib/db/tickets.ts:226-261` (listOpenTickets function)

**Interfaces:**
- Consumes: existing `Ticket` type, `listOpenTickets` function
- Produces: updated `Ticket` type with `createdByName` and `createdAt`; `listOpenTickets` returns creator names

- [ ] **Step 1: Add fields to `Ticket` type**

In `src/features/tickets/api/types.ts`, add two fields to the `Ticket` type after `completedAt`:

```ts
export type Ticket = {
  id: number;
  ticketCode: string | null;
  title: string;
  description: string;
  channel: TicketChannel;
  customer: { id: string; name: string } | null;
  assetName: string;
  taskType: TicketTaskType;
  domain: TicketDomain;
  status: TicketStatus;
  priority: TicketPriority;
  location: { id: number; name: string } | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  requiredSkills: string[];
  assignedTo: string | null;
  takenBy: string | null;
  takenAt: string | null;
  rating: number | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  completedAt: string | null;
  createdByName: string | null;
  createdAt: string;
};
```

- [ ] **Step 2: Update `toTicket` to accept and pass creator info**

In `src/lib/db/tickets.ts`, modify the `toTicket` function to accept a `creatorName` parameter:

```ts
async function toTicket(row: TicketRow, reqs: RequirementRow[], creatorName: string | null = null): Promise<Ticket> {
  const [customer, location] = await Promise.all([
    loadCustomer(row.customer_id),
    loadLocation(row.location_id)
  ]);
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    title: row.title,
    description: row.description,
    channel: row.channel,
    customer,
    assetName: row.asset_name,
    taskType: row.task_type,
    domain: domainOf(row.task_type),
    status: row.status,
    priority: row.priority,
    location,
    dueAt: row.due_at ? row.due_at.toISOString() : null,
    estimatedMinutes: row.estimated_minutes,
    requiredSkills: reqs.map((r) => r.skill).filter((s): s is string => s != null),
    assignedTo: row.assigned_to,
    takenBy: row.taken_by,
    takenAt: row.taken_at ? row.taken_at.toISOString() : null,
    rating: row.rating ?? null,
    reviewNote: row.review_note || null,
    reviewedBy: row.reviewed_by,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    createdByName: creatorName,
    createdAt: row.created_at.toISOString()
  };
}
```

- [ ] **Step 3: Add LEFT JOIN in `listOpenTickets`**

In `src/lib/db/tickets.ts`, modify the `listOpenTickets` function. Import `user` from the auth schema (check existing imports at the top of the file). Add a subquery or LEFT JOIN to get the creator's name:

```ts
import { user } from '../auth-schema';
```

Then in `listOpenTickets`, change the query to include a LEFT JOIN:

```ts
const rows = await db
  .select({
    ticket: tickets,
    creatorName: user.name
  })
  .from(tickets)
  .leftJoin(user, eq(tickets.created_by, user.id))
  .where(where)
  .orderBy(desc(tickets.created_at));
```

Then update the loop that builds tickets:

```ts
for (const row of rows) {
  const reqs = await loadRequirements(row.ticket.id);
  const ticket = await toTicket(row.ticket, reqs, row.creatorName ?? null);
  const reasons = unmetReasons(reqs, profile);
  if (reasons.length === 0) {
    eligible.push(ticket);
  } else {
    unavailable.push({ ...ticket, eligibilityReasons: reasons });
  }
}
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `bun run test:run -- --reporter=verbose src/lib/db/tickets.test.ts`
Expected: All existing tests pass. The new fields are additions, not breaking changes.

- [ ] **Step 5: Run full test suite**

Run: `bun run test:run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/tickets/api/types.ts src/lib/db/tickets.ts
git commit -m "feat(tickets): add creator name and timestamp to open tickets list"
```

---

### Task 2: Add i18n keys

**Files:**
- Modify: `locales/en.json`
- Modify: `locales/id.json`

**Interfaces:**
- Consumes: none
- Produces: i18n keys used by the jobs-page component

- [ ] **Step 1: Add English i18n keys**

In `locales/en.json`, add these keys under the `ticket` namespace (find the existing `ticket` section):

```json
"openTickets": "Open Tickets",
"allDomains": "All",
"field": "Field",
"backoffice": "Backoffice",
"openedBy": "Opened by",
"take": "Take",
"noOpenTickets": "No open tickets available"
```

- [ ] **Step 2: Add Indonesian i18n keys**

In `locales/id.json`, add the same keys with Indonesian translations:

```json
"openTickets": "Tiket Terbuka",
"allDomains": "Semua",
"field": "Lapangan",
"backoffice": "Backoffice",
"openedBy": "Dibuka oleh",
"take": "Ambil",
"noOpenTickets": "Tidak ada tiket terbuka"
```

- [ ] **Step 3: Run i18n check**

Run: `bun run scripts/check-i18n.ts`
Expected: `i18n key parity OK`

- [ ] **Step 4: Commit**

```bash
git add locales/en.json locales/id.json
git commit -m "feat(i18n): add open tickets screen keys (en/id)"
```

---

### Task 3: Rewrite `jobs-page.tsx` with filter chips and Stitch card design

**Files:**
- Rewrite: `src/features/tickets/components/jobs-page.tsx`

**Interfaces:**
- Consumes: `openTicketsQueryOptions` from `../api/queries`, `useTakeTicket` from `../api/hooks`, `Ticket` type from `../api/types`
- Produces: rendered Open Tickets page with filter chips, ticket cards, Take button

- [ ] **Step 1: Read the current `jobs-page.tsx`**

Read `src/features/tickets/components/jobs-page.tsx` to understand the current structure and the route search schema.

- [ ] **Step 2: Rewrite the component**

Replace the entire content of `src/features/tickets/components/jobs-page.tsx` with:

```tsx
import { useTranslation } from 'react-i18next';
import { Link, useSearch, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Route as JobsRoute } from '@/routes/dashboard/jobs/index';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { openTicketsQueryOptions } from '../api/queries';
import { useTakeTicket } from '../api/hooks';
import type { Ticket, TicketPriority, TicketDomain } from '../api/types';
import { useAppLocale } from '@/lib/locale';

const priorityConfig: Record<
  TicketPriority,
  { bg: string; text: string; labelKey: string }
> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-400', labelKey: 'ticket.high' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', labelKey: 'ticket.medium' },
  low: { bg: 'bg-zinc-800', text: 'text-zinc-400', labelKey: 'ticket.low' }
};

const domainLabels: Record<TicketDomain, string> = {
  field: 'ticket.field',
  backoffice: 'ticket.backoffice'
};

function relativeTime(dateStr: string, locale: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function OpenTicketCard({
  ticket,
  onTake
}: {
  ticket: Ticket;
  onTake: (id: number) => void;
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const p = priorityConfig[ticket.priority];

  return (
    <div className='dark:bg-zinc-900 dark:border-zinc-800 flex flex-col gap-4 rounded-[1.5rem] border p-5'>
      <div className='flex items-start justify-between'>
        <div>
          <div className='mb-1 flex items-center gap-2'>
            <span className='dark:text-zinc-500 font-mono text-xs'>{ticket.ticketCode}</span>
            <span
              className={`${p.bg} ${p.text} rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider`}
            >
              {t(p.labelKey)}
            </span>
            <span className='dark:bg-zinc-800 dark:text-zinc-300 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700'>
              {t(domainLabels[ticket.domain])}
            </span>
          </div>
          <h3 className='dark:text-zinc-100 font-semibold leading-tight'>{ticket.title}</h3>
        </div>
      </div>

      <div className='flex flex-col gap-2'>
        {ticket.location && (
          <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.location className='h-[18px] w-[18px]' />
            <span>{ticket.location.name}</span>
          </div>
        )}
        {ticket.createdByName && (
          <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.user className='h-[18px] w-[18px]' />
            <span>
              {t('ticket.openedBy')} {ticket.createdByName} ·{' '}
              {relativeTime(ticket.createdAt, locale)}
            </span>
          </div>
        )}
        {ticket.requiredSkills.length > 0 && (
          <div className='dark:text-zinc-400 flex items-center gap-2 text-sm'>
            <Icons.warning className='h-[18px] w-[18px]' />
            <span>{ticket.requiredSkills.join(', ')}</span>
          </div>
        )}
      </div>

      <Button
        onClick={() => onTake(ticket.id)}
        className={`mt-2 w-full py-3 font-semibold ${
          ticket.priority === 'high'
            ? 'dark:bg-zinc-100 dark:text-zinc-900 bg-zinc-900 text-white'
            : 'dark:bg-zinc-800 dark:text-zinc-100 bg-zinc-200 text-zinc-900'
        }`}
      >
        {t('ticket.take')}
      </Button>
    </div>
  );
}

export default function JobsPage() {
  const { t } = useTranslation();
  const { domain } = useSearch({ from: JobsRoute.id });
  const navigate = useNavigate();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canCreate = isAdmin || permissions.tickets?.add === true;
  const takeTicket = useTakeTicket();

  const filters = {
    ...(domain ? { domain: domain as TicketDomain } : {})
  };

  const { data, isLoading } = useQuery(openTicketsQueryOptions(filters));
  const tickets = data?.tickets ?? [];

  function setDomain(next: TicketDomain | undefined) {
    navigate({ to: '/dashboard/jobs', search: { domain: next } });
  }

  function handleTake(ticketId: number) {
    takeTicket.mutate(ticketId, {
      onSuccess: (res) => {
        if (res?.success) {
          navigate({ to: '/dashboard/tickets/$ticketId', params: { ticketId: String(ticketId) } });
        }
      }
    });
  }

  const chips: { label: string; value: TicketDomain | undefined }[] = [
    { label: t('ticket.allDomains'), value: undefined },
    { label: t('ticket.field'), value: 'field' },
    { label: t('ticket.backoffice'), value: 'backoffice' }
  ];

  return (
    <div className='flex min-h-screen flex-col'>
      {/* Header */}
      <header className='dark:bg-zinc-950 dark:border-zinc-800 sticky top-0 z-50 border-b bg-white'>
        <div className='flex items-center justify-between px-4 py-3'>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => navigate({ to: '..' })}
              className='dark:hover:bg-zinc-900 -ml-2 rounded-full p-2 transition-colors hover:bg-zinc-100'
            >
              <Icons.chevronLeft className='h-5 w-5' />
            </button>
            <h1 className='dark:text-zinc-100 text-lg font-bold tracking-tight'>
              {t('ticket.openTickets')}
            </h1>
          </div>
          {canCreate && (
            <Link to='/dashboard/tickets/new'>
              <button className='dark:hover:bg-zinc-900 -mr-2 rounded-full p-2 transition-colors hover:bg-zinc-100'>
                <Icons.add className='h-5 w-5' />
              </button>
            </Link>
          )}
        </div>

        {/* Filter Chips */}
        <div className='no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3'>
          {chips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => setDomain(chip.value)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
                domain === chip.value
                  ? 'dark:bg-zinc-100 dark:text-zinc-900 bg-zinc-900 text-white'
                  : 'dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 border border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className='flex-1 px-4 py-4'>
        {isLoading ? (
          <div className='flex justify-center py-8'>
            <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : tickets.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {t('ticket.noOpenTickets')}
          </p>
        ) : (
          <div className='flex flex-col gap-4'>
            {tickets.map((ticket) => (
              <OpenTicketCard key={ticket.id} ticket={ticket} onTake={handleTake} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify Icons exist**

Check that `Icons.chevronLeft`, `Icons.add`, `Icons.location`, `Icons.user`, `Icons.warning`, and `Icons.spinner` exist in `src/components/icons.tsx`.

- [ ] **Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: No type errors.

- [ ] **Step 5: Run lint**

Run: `bun run lint`
Expected: No lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/tickets/components/jobs-page.tsx
git commit -m "feat(tickets): redesign open tickets page with filter chips and Stitch cards"
```

---

### Task 4: Add tests for the redesigned page

**Files:**
- Create/Update: `src/features/tickets/components/jobs-page.test.tsx`

**Interfaces:**
- Consumes: rendered `JobsPage` component, mocked queries
- Produces: tests for filter chips, card rendering, Take button, empty state

- [ ] **Step 1: Check if test file exists**

Read `src/features/tickets/components/jobs-page.test.tsx` if it exists. If not, create it.

- [ ] **Step 2: Write tests**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import JobsPage from './jobs-page';

// Mock the route hooks
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({ domain: undefined }),
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  createFileRoute: () => ({
    id: '/dashboard/jobs/',
    useSearch: () => ({ domain: undefined })
  })
}));

// Mock the queries
vi.mock('../api/queries', () => ({
  openTicketsQueryOptions: () => ({
    queryKey: ['tickets', 'open'],
    queryFn: vi.fn()
  })
}));

// Mock the hooks
vi.mock('../api/hooks', () => ({
  useTakeTicket: () => ({
    mutate: vi.fn(),
    isPending: false
  })
}));

vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => ({
    isAdmin: false,
    permissions: { tickets: { add: true } }
  })
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <JobsPage />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

describe('JobsPage', () => {
  it('renders filter chips', () => {
    renderPage();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Field')).toBeInTheDocument();
    expect(screen.getByText('Backoffice')).toBeInTheDocument();
  });

  it('renders header with title', () => {
    renderPage();
    expect(screen.getByText('Open Tickets')).toBeInTheDocument();
  });

  it('shows empty state when no tickets', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no open tickets/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `bun run test:run -- --reporter=verbose src/features/tickets/components/jobs-page.test.tsx`
Expected: Tests pass (or fail with clear reasons to fix).

- [ ] **Step 4: Fix any test failures**

If tests fail, update mocks or assertions to match the actual component behavior.

- [ ] **Step 5: Run full test suite**

Run: `bun run test:run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/tickets/components/jobs-page.test.tsx
git commit -m "test(tickets): add tests for open tickets page redesign"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `bun run typecheck`
Expected: No errors.

- [ ] **Step 2: Run full lint**

Run: `bun run lint`
Expected: No errors.

- [ ] **Step 3: Run format check**

Run: `bun run format:check`
Expected: All files formatted.

- [ ] **Step 4: Run full test suite**

Run: `bun run test:run`
Expected: All tests pass.

- [ ] **Step 5: Run i18n check**

Run: `bun run scripts/check-i18n.ts`
Expected: Key parity OK.

- [ ] **Step 6: Verify dev server starts**

Run: `bun run dev` (background)
Expected: Server starts without errors. Navigate to `/dashboard/jobs/` and verify the page renders.

- [ ] **Step 7: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(tickets): address review feedback on open tickets screen"
```
