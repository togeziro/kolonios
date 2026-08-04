# Attendance Module

The attendance module covers check-in/out, work schedules, leave, corrections, and
admin reporting for both web and mobile layouts.

## Employee flows

- **Check-in / check-out** — an employee checks in once per day from the
  attendance card. The server resolves the employee's effective schedule for
  the day and validates attendance policy (GPS geofence, freshness, accuracy,
  selfie) before creating the record.
- **Location refresh** — the card provides `Get Location` / `Refresh Location`
  using the browser Geolocation API. A map preview shows the device position,
  accuracy, and the selected location's geofence. When GPS validation is
  enabled, stale or inaccurate positions are rejected server-side and the
  employee is asked to refresh.
- **Selfie capture** — optional per policy; captured in-browser via Media
  Capture APIs with preview/retake.
- **Leave requests** — employees submit leave with an optional attachment;
  certain leave types (e.g. sick) require an attachment enforced server-side.
- **Correction requests** — employees can request a correction of their
  check-in/check-out time with a note; the request stays `pending` until an
  admin/HR reviews it.

## Schedule model

- `shifts` is the master schedule definition (name, start/end, type, status).
- `shift_weekday_rules` defines per-weekday working hours, late tolerance, and
  absence cutoff for a shift.
- `schedule_assignments` binds an employee to a shift with `effective_from` /
  `effective_to` (open-ended when null).
- `date_overrides` substitutes a shift for an employee on a specific date.
- `day_offs` marks an individual non-working day (highest precedence).
- The effective schedule for a date is resolved as: assignment → weekday rule
  → date override; a day off wins over everything.

## Policies and validation

- Locations carry GPS/selfie policy: `gps_validation_enabled`, `selfie_required`,
  `max_accuracy_meters`, `max_stale_ms`.
- When GPS validation is enabled the server rejects missing, stale, or
  inaccurate coordinates and positions outside the geofence radius.
- When disabled, check-in still stores coordinates if the browser supplies them
  and marks the record `validation_state = disabled`.
- Late minutes = `max(0, checkIn - (startTime + tolerance))`; absence is
  automatic after the configured cutoff.

## Admin management

- **Locations** (`/dashboard/admin/attendance/locations`) — create/edit work
  locations with an interactive MapLibre map (click or drag to set
  coordinates), geofence radius, and GPS/selfie policy.
- **Schedules** (`/dashboard/admin/attendance/schedules`) — create shifts with
  per-weekday rules.
- **Assignments** (`/dashboard/admin/attendance/assignments`) — assign a
  schedule to one employee or bulk-assign to all employees, and create day
  offs.
- **Reports** (`/dashboard/admin/attendance/reports`) — daily detail table
  filtered by date range, location, shift, and status; export CSV, Excel, or
  PDF.
- **Audit log** — every admin mutation (location, schedule, correction review)
  is recorded with actor, action, before/after values, and can be filtered by
  entity type.

## Implementation notes

- Pure schedule/policy rules live in `src/features/attendance/utils/schedule.ts`
  (no DB/React dependencies) with unit tests in `schedule.test.ts`.
- Browser location handling lives in `src/features/attendance/utils/geolocation.ts`.
- Map rendering uses MapLibre GL (`src/components/ui/map.tsx`) with an
  environment-configurable tile URL (`VITE_MAP_STYLE_URL`).
- All UI copy is localized through i18n (`attendance.*`, `attendanceAdmin.*`).
