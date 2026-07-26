# Attendance Module Documentation

## Implementation Status

**Complete** ✅

| Component | Status |
|-----------|--------|
| Database schema (5 tables) | ✅ Implemented & migrated |
| Masterdata schema (3 tables) | ✅ Implemented & migrated |
| RBAC roles (admin, hr, employee, technician) | ✅ Implemented |
| Session helpers (requireHR, requireEmployee, requireTechnician) | ✅ Implemented |
| Seed data (locations, shifts, departments, designations, users) | ✅ Implemented |
| Data access layer (Haversine geo-fence) | ✅ Implemented |
| Server functions (checkIn, checkOut, leave, performance) | ✅ Implemented |
| Check-in/out frontend (card + history) | ✅ Implemented |
| Leave management (form + history) | ✅ Implemented |
| Mobile staff dashboard | ✅ Implemented |
| Documentation | ✅ Complete |

## Overview

The Attendance Module provides employee attendance management with geo-fencing capabilities, leave requests, and performance tracking. It follows the same patterns as the existing kolonios codebase using TanStack Start, Drizzle ORM, and Better Auth.

The module includes a **mobile-first staff dashboard** (`/dashboard` for employees/technicians on mobile) with circular progress, bottom navigation, FAB check-in, and swipeable task groups.

## Database Schema

### Tables

#### `locations`
Company office locations used for geo-fencing check-in/out.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| name | text | Location name (e.g., "HQ Jakarta") |
| latitude | real | Latitude coordinate |
| longitude | real | Longitude coordinate |
| radius | real | Check-in radius in meters (default: 100) |
| description | text | Additional notes |
| status | text | Active/inactive status |

#### `shifts`
Employee shift definitions (inspired by SC_absensi).

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| name | text | Shift name (e.g., "Morning Shift") |
| start_time | text | Scheduled check-in time (HH:MM format) |
| end_time | text | Scheduled check-out time (HH:MM format) |
| type | shiftTypeEnum | fixed or flexible |
| status | shiftStatusEnum | active or inactive |

#### `employee_shifts`
Daily attendance records (mapping shift pattern from Laravel).

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | text | Employee ID |
| shift_id | integer | Assigned shift |
| date | text | Attendance date (YYYY-MM-DD) |
| check_in_time | text | Actual check-in time |
| late_duration | real | Minutes late |
| check_out_time | text | Actual check-out time |
| early_out_duration | real | Minutes early |
| check_in_latitude/check_in_longitude | real | Check-in coordinates |
| check_out_latitude/check_out_longitude | real | Check-out coordinates |
| lock_location | integer | 1 = geo-fence required |
| request_status | leaveStatusEnum | Approval status |

#### `leaves`
Leave request system (cuti from SC_absensi).

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | text | Employee ID |
| start_date | text | Start date |
| end_date | text | End date |
| total_days | real | Total days |
| leave_type | leaveTypeEnum | annual, sick, personal, emergency |
| reason | text | Reason for leave |
| request_file | text | File attachment |
| status | leaveStatusEnum | pending, approved, rejected, cancelled |

#### `performance_reports`
Performance tracking (Laporan Kinerja from SC_absensi).

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | text | Employee ID |
| date | text | Report date |
| score | numeric | Score value |
| running_average | numeric | Running average score |
| reference | text | Related entity (e.g., "employee_shifts") |
| reference_id | text | Related entity ID |

## RBAC Roles

### `admin`
Full access to all attendance features.

### `hr`
- Read all attendance records
- Update attendance (for corrections)
- Full leave management
- Read employee data
- Read locations and shifts

### `employee`
- Check-in/check-out (create attendance)
- View own attendance history
- Request and view own leaves
- Cannot modify others' data

### `technician`
Identical to `employee` role for field workers.

## Geo-fencing Implementation

The distance calculation uses the Haversine formula:

```typescript
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}
```

## API Patterns (Server Functions)

Following the existing kolonios patterns:

```typescript
// Check-in with location validation
export const checkInFn = createServerFn({ method: 'POST' })
  .validator(checkInSchema)
  .handler(async ({ data }) => {
    await requireEmployee();
    return checkIn(data, session.user.id);
  });

// Check-out with location validation
export const checkOutFn = createServerFn({ method: 'POST' })
  .validator(checkOutSchema)
  .handler(async ({ data }) => {
    await requireEmployee();
    return checkOut(data, session.user.id);
  });

// Get today's attendance
export const getMyAttendanceFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requireEmployee();
    return getMyAttendance(session.user.id);
  });

// Get attendance history with filters
export const getAttendanceHistoryFn = createServerFn({ method: 'GET' })
  .validator(attendanceFiltersSchema)
  .handler(async ({ data }) => {
    await requireEmployee();
    return getAttendanceHistory(session.user.id, data);
  });

// Get leave requests
export const getMyLeavesFn = createServerFn({ method: 'GET' })
  .validator(leaveFiltersSchema)
  .handler(async ({ data }) => {
    await requireEmployee();
    return getMyLeaves(session.user.id, data);
  });

// Create leave request
export const createLeaveRequestFn = createServerFn({ method: 'POST' })
  .validator(leaveRequestSchema)
  .handler(async ({ data }) => {
    await requireEmployee();
    return createLeaveRequest(data, session.user.id);
  });

// Get performance stats
export const getPerformanceStatsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await requireEmployee();
    return getPerformanceStats(session.user.id);
  });
```

Server functions live in `src/features/attendance/api/service.ts`. All enforce `requireEmployee()` at the handler level.

## Frontend Components

### Route Pages

- **`/dashboard/attendance`** — `AttendancePage` combines `AttendanceCheckCard` (today's status, check-in/out button) with `AttendanceHistory` (paginated history table with date/status filters)
- **`/dashboard/leave`** — `LeavePage` combines `LeaveRequestForm` (type, dates, reason) with `LeaveHistory` (leave requests list with status badges)

### Mobile Dashboard

- **`/dashboard/overview`** — Renders `StaffMobileDashboard` when user role is `employee` or `technician` and screen is mobile-sized (`< 768px`)
- **`StaffMobileDashboard`** — Composes `MobileAttendanceSummary` (circular progress + check-in/out card), `InProgressTasks` (horizontal scroll), `TaskGroups` (vertical department groups with progress circles)
- **Layout** — `MobileShell` wrapper replaces sidebar/header with `MobileHeader` + `BottomNav` + FAB

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `AttendanceCheckCard` | `src/features/attendance/components/attendance-check-card.tsx` | Today's check-in status, check-in/out button |
| `AttendanceHistory` | `src/features/attendance/components/attendance-history.tsx` | Paginated history table with filters |
| `LeaveRequestForm` | `src/features/attendance/components/leave-request-form.tsx` | Leave type, dates, reason inputs |
| `LeaveHistory` | `src/features/attendance/components/leave-history.tsx` | Leave list with status badges |
| `StaffMobileDashboard` | `src/features/attendance/components/staff-mobile-dashboard.tsx` | Mobile home dashboard composable |
| `MobileAttendanceSummary` | `src/features/attendance/components/mobile-attendance-summary.tsx` | Circular progress + check-in/out card |
| `InProgressTasks` | `src/features/attendance/components/in-progress-tasks.tsx` | Horizontal scroll task cards |
| `TaskGroups` | `src/features/attendance/components/task-groups.tsx` | Department group list with progress |

## Integration with Notifications

Attendance events trigger notifications:

```typescript
// After check-in
await addNotificationFn({
  title: 'Check-in recorded',
  body: `You checked in at ${check_in_time} (late by ${late_duration} minutes)`,
  action: 'attendance',
  userId: session.user.id
});

// After leave approval
if (status === 'approved') {
  await addNotificationFn({
    title: 'Leave approved',
    body: `Your leave request for ${start_date} has been approved`,
    action: 'leaves',
    userId: user_id
  });
}
```

## Self-Hosted Deployment Notes

For VPS deployment, add to PM2 ecosystem.config.js:

```javascript
module.exports = {
  apps: [{
    name: 'attendance-dashboard',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: process.env.DATABASE_URL
    }
  }]
};
```

## Security Guardrails

1. **Location privacy**: Coordinates are stored but not shared in API responses
2. **Rate limiting**: Check-in limited to once per day per user
3. **Authorization**: Users can only modify their own attendance unless admin/HR
4. **Image storage**: Photos stored securely, accessed only by authorized personnel

## Development Tools

### Drizzle Studio

Drizzle Studio provides a web-based GUI for database inspection and management.

**Starting Drizzle Studio:**

```bash
bun run db:studio
```

By default, the server starts on `127.0.0.1:4983` and the UI is accessible at
`https://local.drizzle.studio`.

**Remote access (from outside the VM):**

Since Drizzle Studio v0.31.10 uses a Cloudflare-hosted UI, direct browser access
to the server port is not supported. For remote development:

1. **SSH tunnel** (recommended):
   ```bash
   ssh -L 4983:localhost:4983 user@172.17.16.3
   # Then open: https://local.drizzle.studio?host=127.0.0.1&port=4983
   ```

2. **Run with custom host/port**:
   ```bash
   bunx drizzle-kit studio --host 0.0.0.0 --port 4983
   ```

**Note:** The hosted version of Drizzle Studio is intended for local development
only. For VPS deployment, consider using the Drizzle Studio Gateway (alpha) or
an alternative database GUI tool (pgAdmin, DBeaver, TablePlus).