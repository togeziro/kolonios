# Open Tickets Screen — Design Spec

> Status: approved. Replaces the existing desktop-style `jobs-page.tsx` with a
> mobile-first design matching the Stitch "Open Tickets" screen. Route stays at
> `/dashboard/jobs/`.

## Context

The Stitch project has an "Open Tickets" screen (screen ID `0d5eaf8a3d9949faa70a9053410c1394`)
that hasn't been built yet. The existing `jobs-page.tsx` at `/dashboard/jobs/` uses desktop-style
Select dropdowns for filtering — it works but doesn't match the Stitch mobile design.

The `/dashboard/jobs/` route is also the "Office" tab in the mobile bottom nav for fieldops
(technician + SPV), so this page is already mobile-facing. Redesigning it to match Stitch is the
natural path.

## Goals

1. Match the Stitch "Open Tickets" screen design (filter chips, card layout, Take button)
2. Show creator name and relative time ("Opened by Ahmad · 2h ago")
3. Enable ticket creation from the header (+) button
4. Keep the desktop route functional (filter chips degrade well on wider screens)

## Non-goals

- Priority filter chips (Stitch design only shows domain chips; priority filtering removed from main UI)
- Pagination (open ticket list is expected to be small — technicians have max 3 active tickets)
- "Unavailable" section redesign (stays as dimmed cards with eligibility reasons)

## Design

### Layout

```
┌─────────────────────────────────────┐
│ ←  Open Tickets                 +   │  ← fixed header
├─────────────────────────────────────┤
│ [All] [Field] [Backoffice]          │  ← filter chips (scrollable)
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ T-1042  [HIGH]  [FIELD]    │    │
│  │                             │    │
│  │ Install fiber drop at ...   │    │
│  │ 📍 Kedungwaringin           │    │
│  │ 👤 Opened by Ahmad · 2h ago │    │
│  │ ⚠️  Requires ladder         │    │
│  │                             │    │
│  │ ┌───────────────────────┐   │    │
│  │ │        Take           │   │    │
│  │ └───────────────────────┘   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ T-1045  [MED]   [FIELD]    │    │
│  │ ...                         │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### Header

- Fixed position, `bg-zinc-950 border-b border-zinc-800`
- Back arrow (←) on left — calls `navigate({ to: '..' })` (browser history back)
- Title "Open Tickets" — bold, `text-lg`
- "+" button on right — links to `/dashboard/tickets/new`

### Filter Chips

- Horizontal row below header, `overflow-x-auto no-scrollbar`
- Three chips: All | Field | Backoffice
- Active chip: `bg-zinc-100 text-zinc-900 rounded-full px-4 py-1.5 text-sm font-medium`
- Inactive chip: `border border-zinc-800 text-zinc-400 rounded-full px-4 py-1.5 text-sm font-medium`
- Clicking a chip updates URL search param: `?domain=field`, `?domain=backoffice`, or no param for All
- Priority filter removed from the UI (was a Select dropdown before)

### Ticket Card

Each card is a `bg-zinc-900 border border-zinc-800 rounded-[1.5rem] p-5` container.

**Top section:**
- Row 1: ticket code (`T-{id}`, monospace `text-xs text-zinc-500`) + priority badge + domain badge
  - Priority badge: `rounded-full px-2 py-0.5 text-[10px] font-bold uppercase`
    - High: `bg-red-500/10 text-red-400`
    - Medium: `bg-amber-500/10 text-amber-400`
    - Low: `bg-zinc-800 text-zinc-400`
  - Domain badge: `rounded-full bg-zinc-800 text-zinc-300 px-2 py-0.5 text-[10px] font-bold uppercase`
- Row 2: title — `font-semibold text-zinc-100 leading-tight`

**Info section (vertical stack):**
- Location row: location icon + location name (if `ticket.location` exists)
- Creator row: person icon + "Opened by {creatorName} · {relativeTime}" (if `createdByName` available)
- Skills row: warning icon + required skills (only if `ticket.requiredSkills.length > 0`)

**Take button:**
- Full-width, `py-3 rounded-xl font-semibold`
- High priority: `bg-zinc-100 text-zinc-900` (prominent)
- Others: `bg-zinc-800 text-zinc-100`
- On click: `useTakeTicket(ticketId)` → on success, navigate to `/dashboard/tickets/$ticketId`
- Disabled state while mutation is pending

**Unavailable tickets:**
- Same card structure but `opacity-75`
- Take button shown but visually dimmed
- Eligibility reasons displayed as info text

**Empty state:**
- Centered message: "No open tickets available"
- `text-muted-foreground text-sm`

### Data Flow

#### Server: `listOpenTickets` changes

In `src/lib/db/tickets.ts`, the `listOpenTickets` function:

1. Add LEFT JOIN on `user` table via `tickets.created_by` to get creator's `name`
2. Include `createdByName` and `createdAt` in the returned `Ticket` type
3. Filter logic unchanged (domain, priority filters still supported)

```sql
SELECT tickets.*, "user".name AS creator_name
FROM tickets
LEFT JOIN "user" ON tickets.created_by = "user".id
WHERE tickets.status = 'open'
  AND [domain filter]
  AND [priority filter]
ORDER BY tickets.created_at DESC
```

#### Type changes

`Ticket` type in `src/features/tickets/api/types.ts`:

```ts
export type Ticket = {
  // ... existing fields ...
  createdByName: string | null;   // NEW — creator's display name
  createdAt: string;              // NEW — ISO timestamp
};
```

#### Client: `jobs-page.tsx` rewrite

- Replace Select dropdowns with filter chips (controlled via `useSearch` + `navigate`)
- New card component (inline or extracted to `open-ticket-card.tsx`)
- `useTakeTicket` mutation wired to Take button
- Loading spinner, empty state, error handling

### i18n

New keys (en + id):

| Key | EN | ID |
|-----|----|----|
| `ticket.openTickets` | Open Tickets | Tiket Terbuka |
| `ticket.allDomains` | All | Semua |
| `ticket.field` | Field | Lapangan |
| `ticket.backoffice` | Backoffice | Backoffice |
| `ticket.openedBy` | Opened by | Dibuka oleh |
| `ticket.take` | Take | Ambil |
| `ticket.noOpenTickets` | No open tickets available | Tidak ada tiket terbuka |
| `ticket.creationEnabled` | Creation enabled for your role | Pembuatan diaktifkan untuk peran Anda |

### Files Modified

| File | Change |
|------|--------|
| `src/lib/db/tickets.ts` | Add creator name JOIN in `listOpenTickets` |
| `src/features/tickets/api/types.ts` | Add `createdByName`, `createdAt` to `Ticket` |
| `src/features/tickets/components/jobs-page.tsx` | Full rewrite — chips, new cards, Take button |
| `src/features/tickets/api/service.ts` | No change (filter already supported) |
| `src/features/tickets/api/queries.ts` | No change (filter already supported) |
| `src/features/tickets/api/hooks.ts` | No change (`useTakeTicket` exists) |
| `locales/en.json` | Add new i18n keys |
| `locales/id.json` | Add new i18n keys |

### Files NOT modified

| File | Reason |
|------|--------|
| `ticket-card.tsx` | Used by other screens (My Work, Available tab) — keep as-is |
| `available-tab.tsx` | Serves My Work "Available" tab — different context |
| `available-jobs-section.tsx` | Serves dashboard homepage section — different context |
| Route file (`routes/dashboard/jobs/index.tsx`) | No change needed |

## Testing

- Update or add tests for the rewritten `jobs-page.tsx` component
- Test filter chip clicks update URL params
- Test Take button triggers mutation and navigates on success
- Test empty state renders correctly
- Test unavailable tickets render with dimmed styling
- Verify `listOpenTickets` returns `createdByName` in the response
