# Attendance Expansion Design

## Status

Proposed design for review.

## Scope

This feature expands the existing attendance module for both employees and
administrators/HR. The implementation must preserve the existing i18n model;
English and Indonesian UI strings remain in the locale files and must not be
hardcoded in components or server functions.

The first release includes:

- Recurring work schedules and shift definitions.
- Employee and bulk schedule assignments.
- Date-specific schedule overrides.
- Individual day-off overrides.
- GPS and selfie-aware check-in/check-out.
- Configurable late tolerance and automatic absence cutoff.
- Leave/permission requests with configurable attachment requirements.
- Attendance correction with reason and audit log.
- Employee-period summaries, daily details, filtering, and export.
- Admin location management with an interactive map and geofence radius.

The first release does not include company-wide holiday calendars, multiple
attendance sessions per day, in-app turn-by-turn navigation, or self-hosted
routing infrastructure.

## User Rules

### Scheduling

- A work schedule is a recurring schedule that remains active until replaced.
- A schedule can be assigned to one employee or in bulk by group/division.
- A day-off record overrides the recurring schedule for an individual employee.
- An employee without an active schedule cannot check in by default.
- An administrator can grant a manual exception for an unscheduled check-in.
- An employee has at most one check-in and one check-out per day.
- Historical attendance must retain the schedule context used when it was
  created; later schedule changes must not rewrite history.

### Attendance validation

- Selfie requirements are configurable by location or schedule.
- GPS validation is configurable by location or schedule and is enabled by
  default.
- When GPS validation is enabled, the server requires a current location,
  acceptable accuracy, and a position inside the configured geofence.
- When GPS validation is disabled, check-in is allowed without geofence
  validation. If the browser supplies coordinates, they are still stored and
  the attendance record is marked as not GPS-validated.
- A stale, unavailable, or too-inaccurate location causes check-in to be
  rejected when GPS validation is enabled.
- The employee map displays the device location and accuracy, but employees
  cannot move a marker to forge the submitted coordinates.
- The server recomputes geofence distance using the stored coordinates; client
  map state is informational only.

### Timing

- Late tolerance is configured on the schedule.
- A zero-minute tolerance means a check-in after the scheduled start is late.
- An employee is automatically absent after the configured cutoff if no
  check-in exists.

### Leave and corrections

- Employees submit leave/permission requests.
- Administrators and HR approve or reject requests through role-group
  permissions.
- Administrators can assign individual day off directly.
- Attachment requirements are configurable by leave type.
- Attendance corrections require a reason and create an audit record containing
  the actor, time, previous values, and new values.

## Architecture

### Schedule model

The scheduling model reuses the existing `shifts` table as the master schedule
definition and is composed of:

- `shifts`: schedule metadata, start/end times, and default policy settings.
- `shift_schedule_days`: per-weekday start/end times and working-day rules when
  a shift uses a recurring weekly pattern.
- `employee_schedule_assignments`: employee-to-schedule binding.
- `employee_schedule_overrides`: date-specific alternate shift assignments.
- `employee_days_off`: individual day-off overrides.

The effective schedule for a date is resolved from the employee assignment, the
weekday rule, and any date-specific override. A day-off override takes
precedence over an alternate shift override. The resolved schedule snapshot or
reference used for attendance must remain available for historical reporting.

Existing locations, shifts, employee attendance, and leave data should be
extended only where necessary. Existing feature patterns and shared database
utilities must be reused instead of introducing a parallel data-access model.

### Location model

The existing `locations` model remains the source of work-site coordinates and
radius. It gains policy configuration for GPS validation, selfie requirement,
and acceptable location accuracy/staleness. If a schedule also supplies a
policy override, the more specific schedule policy takes precedence over the
location default; otherwise the location policy applies.

The admin location form contains a map, name, description, status, radius,
latitude, and longitude. Clicking the map or dragging the marker updates the
coordinates. A circle visualizes the geofence in meters.

### Corrections and audit

Attendance corrections require a dedicated correction record or equivalent
audit-backed mutation boundary. The audit data must make it possible to answer
who changed an attendance record, when, why, and which fields changed.

### Client/server flow

Employee check-in flow:

1. The employee requests the current browser location.
2. The client displays the position, accuracy, and geofence preview.
3. The employee captures a selfie when required.
4. The client submits coordinates, accuracy, location timestamp, selfie, and
   selected attendance context.
5. The server resolves the effective schedule and validates all policies.
6. The server creates the single daily attendance record or returns a domain
   error.

The server remains the authorization, validation, and persistence boundary.
All server functions use runtime Zod validation, `requirePermission`, shared
error mapping, and React Query invalidation patterns already established in the
repository.

## Map And Routing Strategy

Use `mapcn` with MapLibre as the map UI foundation. It aligns with the existing
Tailwind/shadcn visual system and supports the marker, viewport, control, and
layer needs for location management and employee location preview.

The map provider is configuration, not business logic. The implementation must
avoid embedding provider credentials in client code beyond the provider's
public-key model and must keep provider-specific code isolated.

The first release does not add deck.gl, Valhalla, or a routing service. Future
routing uses an adapter boundary so a managed provider such as MapTiler or a
self-hosted service such as Valhalla can be selected later:

```text
RoutingService -> provider adapter -> route preview data
```

The future technician flow displays a route preview in the application and
offers a link to external navigation such as Google Maps or Apple Maps. The
PWA does not attempt to provide background location tracking or turn-by-turn
navigation.

## Dependencies

No new framework is required. The existing TanStack, Drizzle, Zod, React Query,
form, table, date, and testing dependencies cover the feature.

The map implementation may add:

- `maplibre-gl`.
- `@types/geojson` if required by the selected map components.

The `mapcn` components should be integrated according to the repository's
existing component conventions. Any icon dependency used by the upstream
component should be adapted to the existing icon package where practical.

Export and upload dependencies remain an implementation decision. CSV can be
generated without a new dependency. Excel, PDF, and attachment upload must be
evaluated separately before adding packages.

## Error Handling

The feature must expose localized, safe domain errors for:

- Missing active schedule.
- Existing daily attendance.
- Missing or denied location permission.
- Stale or inaccurate location.
- Position outside the geofence.
- Required selfie failure.
- Check-in cutoff exceeded.
- Missing correction or approval reason.
- Export failure or excessive result size.

Errors must not expose database details. Loading, empty, and error states must
follow the existing route and component standards.

## Testing Strategy

Unit tests cover effective schedule resolution, day-off overrides, late
tolerance, absence cutoff, Haversine distance, GPS enabled/disabled behavior,
stale coordinates, and selfie policy resolution.

Integration tests cover schedule assignment, day off, check-in/check-out,
leave approval, correction audit records, and report filters.

Playwright tests cover the primary admin and employee flows, including location
form interaction, employee location refresh, valid check-in, rejected invalid
GPS, GPS-disabled check-in, and report export. Map and routing providers must
be mocked in automated tests so tests do not depend on external network
services.

## Out Of Scope

- Company-wide or national holiday calendars.
- Multiple shifts or attendance sessions per day.
- Native mobile background location.
- In-app turn-by-turn navigation.
- Self-hosted routing infrastructure.
- Large-scale geospatial analytics requiring deck.gl.
