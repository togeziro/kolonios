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
| `BottomNav` | `src/components/layout/bottom-nav.tsx` | Fixed bottom nav (Home, Attendance, Leave, Profile) + FAB check-in |

#### Staff Dashboard (Home)

| Component | File | Purpose |
|-----------|------|---------|
| `StaffMobileDashboard` | `src/features/attendance/components/staff-mobile-dashboard.tsx` | Composes all mobile home fragments |
| `MobileAttendanceSummary` | `src/features/attendance/components/mobile-attendance-summary.tsx` | Circular progress ring + check-in/out status |
| `InProgressTasks` | `src/features/attendance/components/in-progress-tasks.tsx` | Horizontal scroll task cards |
| `TaskGroups` | `src/features/attendance/components/task-groups.tsx` | Vertical department list with progress circles |

### Detection

- **`useIsMobile`** (`src/hooks/use-is-mobile.ts`) — CSS media query `(max-width: 767px)` via `window.matchMedia`
- Recalculates on resize; no user-agent sniffing needed

### Navigation

Bottom nav items (currently 4):
- **Home** → `/dashboard/overview`
- **Attendance** → `/dashboard/attendance`
- **Leave** → `/dashboard/leave`
- **Profile** → `/dashboard/notifications`

A **FAB (floating action button)** appears above the bottom nav when the user is not yet checked out — tapping it triggers `checkInFn`.

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
