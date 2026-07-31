# Mobile Layout Documentation

## Overview

The mobile layout provides a responsive, mobile-first experience for staff roles (`employee` and `technician`) on small screens (<768px). It replaces the desktop sidebar/header layout with a bottom-navigation shell optimized for field workers.

## Architecture

### Layout Decision Flow

`src/routes/dashboard.tsx` (line ~35):

```tsx
const isMobile = useIsMobile();
const { data: session } = useSession();
const isStaff = session?.user?.role === 'employee' || session?.user?.role === 'technician';

if (isMobile && isStaff) {
  return <MobileShell />;  // mobile layout
}
return <SidebarLayout />;   // desktop layout (sidebar + header)
```

The same pattern applies in `src/routes/dashboard/overview.tsx` — `StaffMobileDashboard` renders for mobile+staff, while admin/hr see the Recharts overview.

### Components

#### Layout Shell

| Component | File | Purpose |
|-----------|------|---------|
| `MobileShell` | `src/components/layout/mobile-shell.tsx` | Wraps page content with `MobileHeader` + `<Outlet>` + `BottomNav` |
| `MobileHeader` | `src/components/layout/mobile-header.tsx` | Avatar + greeting + notification badge + sign-out dropdown |
| `BottomNav` | `src/components/layout/bottom-nav.tsx` | Fixed bottom nav (Home, My Work, Attendance, Leave, Profile) + FAB attendance shortcut |

#### Staff Dashboard (Home)

`StaffMobileDashboard` (`src/features/attendance/components/staff-mobile-dashboard.tsx`) composes the home sections in order:

| Component | File | Purpose |
|-----------|------|---------|
| `MobileAttendanceSummary` | `src/features/attendance/components/mobile-attendance-summary.tsx` | Today's status strip: check-in/out state + attendance badge, links to attendance |
| `MyWorkSection` | `src/features/tasks/components/my-work-section.tsx` | Assigned/in-progress tasks (up to 3) with bottom-sheet detail |
| `AvailableJobsSection` | `src/features/tasks/components/available-jobs-section.tsx` | Eligibility-gated job pool with horizontal task cards + Take action |
| `NotAvailableSection` | `src/features/tasks/components/not-available-section.tsx` | Collapsible list of ineligible tasks with reasons (no actions) |
| `PerformanceSnapshot` | `src/features/attendance/components/performance-snapshot.tsx` | Latest performance score card (hidden when no reports) |

#### Task Screens

| Component | File | Purpose |
|-----------|------|---------|
| `MyWorkPage` | `src/features/tasks/components/my-work-page.tsx` | Full My Work screen: In Progress + Assigned sections (`/dashboard/my-work`) |
| `JobsPage` | `src/features/tasks/components/jobs-page.tsx` | Full Available Jobs screen with location/priority filters (`/dashboard/jobs`) |
| `TaskCard` | `src/features/tasks/components/task-card.tsx` | Task card: type, priority, status, location, due date, required skills |
| `TaskDetailSheet` | `src/features/tasks/components/task-detail-sheet.tsx` | Bottom-sheet task detail with Take / Mark Complete / Open My Work actions |

### Detection

- **`useIsMobile`** (`src/hooks/use-is-mobile.ts`) — CSS media query `(max-width: 767px)` via `window.matchMedia`
- Recalculates on resize; no user-agent sniffing needed

### Navigation

Bottom nav items (5 tabs):
- **Home** → `/dashboard/overview`
- **My Work** → `/dashboard/my-work`
- **Attendance** → `/dashboard/attendance`
- **Leave** → `/dashboard/leave`
- **Profile** → `/dashboard/profile`

A **FAB (floating action button)** appears above the bottom nav — it is a plain `Link` to `/dashboard/attendance` and only navigates (no implicit check-in or mutation).

### Sign Out

Tap the avatar in `MobileHeader` to open a dropdown with user info (name, email) and a **Sign out** button. Calls `signOut()` then navigates to `/`.

## Styling

- All components use Tailwind CSS v4
- Animations via `motion` (Framer Motion v11+)
- `MobileShell` has `pb-20` to account for the fixed bottom nav height
- `BottomNav` has `bg-background/80` with `backdrop-blur-lg` frosted glass effect
- FAB uses `spring` animation for natural bounce on mount/unmount

## Dependencies

- `motion` (v11.18) — Animations (already in repo)
- `useIsMobile` — Custom hook (no external library)
