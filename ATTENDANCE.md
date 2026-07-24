# Attendance Module Documentation

## Overview

The Attendance Module provides employee attendance management with geo-fencing capabilities, leave requests, and performance tracking. It follows the same patterns as the existing kolonios codebase using TanStack Start, Drizzle ORM, and Better Auth.

## Database Schema

### Tables

#### `locations`
Company office locations used for geo-fencing check-in/out.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| nama_lokasi | text | Location name (e.g., "HQ Jakarta") |
| lat_kantor | real | Latitude coordinate |
| long_kantor | real | Longitude coordinate |
| radius | real | Check-in radius in meters (default: 100) |
| keterangan | text | Additional notes |
| status | text | Active/inactive status |

#### `shifts`
Employee shift definitions (inspired by SC_absensi).

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| nama_shift | text | Shift name (e.g., "Morning Shift") |
| jam_masuk | text | Scheduled check-in time (HH:MM format) |
| jam_keluar | text | Scheduled check-out time (HH:MM format) |
| type | shiftTypeEnum | fixed or flexible |
| status | shiftStatusEnum | active or inactive |

#### `employee_shifts`
Daily attendance records (mapping shift pattern from Laravel).

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | text | Employee ID |
| shift_id | integer | Assigned shift |
| tanggal | text | Attendance date (YYYY-MM-DD) |
| jam_absen | text | Actual check-in time |
| telat | real | Minutes late |
| jam_pulang | text | Actual check-out time |
| pulang_cepat | real | Minutes early |
| lat_absen/long_absen | real | Check-in coordinates |
| lat_pulang/long_pulang | real | Check-out coordinates |
| lock_location | integer | 1 = geo-fence required |
| status_pengajuan | leaveStatusEnum | Approval status |

#### `leaves`
Leave request system (cuti from SC_absensi).

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | text | Employee ID |
| tanggal_mulai | text | Start date |
| tanggal_akhir | text | End date |
| jumlah_hari | real | Total days |
| jenis_cuti | leaveTypeEnum | annual, sick, personal, emergency |
| alasan | text | Reason for leave |
| status | leaveStatusEnum | pending, approved, rejected, cancelled |

#### `performance_reports`
Performance tracking (Laporan Kinerja from SC_absensi).

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| user_id | text | Employee ID |
| tanggal | text | Report date |
| nilai | numeric | Score value |
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
    await requireRole('employee');
    const { checkIn } = await import('@/lib/db/attendance');
    return checkIn(data, session.user.id);
  });

// Get employee attendance history
export const getEmployeeAttendanceFn = createServerFn({ method: 'GET' })
  .validator(attendanceFiltersSchema)
  .handler(async ({ data }) => {
    await requireRole('employee');
    const { getEmployeeAttendance } = await import('@/lib/db/attendance');
    return getEmployeeAttendance(data);
  });
```

## UI/UX Patterns

Following the kolonios UI patterns:

- Use `shadcn/ui` components (Dialog, Table, Form, Calendar)
- Use `motion` for animations
- Use `sonner` for toast notifications
- Use `TanStack Table` for data tables with URL state sync
- Use `TanStack Form` + `Zod` for form validation

## Integration with Notifications

Attendance events trigger notifications:

```typescript
// After check-in
await addNotificationFn({
  title: 'Check-in recorded',
  body: `You checked in at ${jam_absen} (late by ${telat} minutes)`,
  action: 'attendance',
  userId: session.user.id
});

// After leave approval
if (status === 'approved') {
  await addNotificationFn({
    title: 'Leave approved',
    body: `Your leave request for ${tanggal_mulai} has been approved`,
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