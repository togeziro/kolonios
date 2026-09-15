/**
 * Ticket 05 — headless E2E for the unified check-in flow (Opsi C).
 *
 * No physical camera/GPS in the VM: face verification is intercepted at the
 * TanStack Start server-function transport (`/_serverFn/*` POST) with canned
 * MATCH / NO_MATCH / NOT_ENROLLED `{result}` payloads, and
 * device position comes from Playwright's geolocation override (the app's
 * getCurrentLocation reads navigator.geolocation).
 *
 * DB fixture (per test, via the shared dev DB):
 * - technician schedule assignment on the Morning Shift (all-weekday rules)
 *   so the server resolves an effective schedule for "today";
 * - technician face_descriptor cleared or set to a known 1024-d vector;
 * - two real locations: NORMAL (selfie_required=false -> face-match required)
 *   and RELAXED (selfie_required=true -> face-match relaxed per T02), both
 *   geofenced on the same fake fix with GPS validation ON;
 * - today's employee_shifts row for the technician removed (idempotent runs).
 *
 * Photo upload is stubbed: getUploadUrlFn is intercepted with a fake
 * presigned URL and the PUT is short-circuited, so no S3/MinIO is needed.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { user } from '../src/lib/db/auth-schema';
import {
  employeeShifts,
  locations,
  scheduleAssignments,
  shifts,
  shiftWeekdayRules
} from '../src/lib/db/schema/attendance';
import { businessDateInTimeZone } from '../src/lib/dates';

// Fake GPS fix: inside BOTH fixture geofences (each centered here, r=500m).
const FIX = { latitude: -6.2, longitude: 106.8, accuracy: 10 };

// The server only accepts descriptors of length 1024 (isFaceDescriptor).
const ENROLLED_DESCRIPTOR = Array.from({ length: 1024 }, (_, i) => Math.sin(i) * 0.01);

// Canned server-function payloads use the plain {result} envelope: proven
// live against this TanStack Start version — the client returns
// body.result directly for application/json without x-tss-serialized.
function cannedResult(result: Record<string, unknown>): string {
  return JSON.stringify({ result });
}

function cannedSuccess(result: Record<string, unknown>) {
  return { status: 200, contentType: 'application/json', body: cannedResult(result) };
}

function serverFnExport(url: string): string {
  const tail = url.split('/_serverFn/')[1] ?? '';
  try {
    return (JSON.parse(Buffer.from(tail, 'base64').toString()).export ?? '') as string;
  } catch {
    return '';
  }
}

type VerifyDecision = 'MATCH' | 'NO_MATCH' | 'NOT_ENROLLED';

/** Route handler shared by all tests: canned face verdicts + stubbed uploads. */
async function installServerStubs(page: Page, decision: VerifyDecision) {
  await page.route('**/_serverFn/*', async (route: Route) => {
    const req = route.request();
    const exp = serverFnExport(req.url());
    if (req.method() === 'POST' && exp.includes('erifyFaceFn')) {
      const verdict =
        decision === 'MATCH'
          ? { verified: true, reason: 'MATCH', confidence: 1, distance: 0 }
          : decision === 'NO_MATCH'
            ? { verified: false, reason: 'NO_MATCH', confidence: 0, distance: 999 }
            : { verified: false, reason: 'NOT_ENROLLED' };
      return route.fulfill(cannedSuccess(verdict));
    }
    if (req.method() === 'POST' && exp.includes('getUploadUrlFn')) {
      return route.fulfill(
        cannedSuccess({
          url: 'https://upload-stub.invalid/put',
          key: 'attendance/stub/selfie.jpg'
        })
      );
    }
    return route.continue();
  });
  // Short-circuit the S3 PUT — the app only checks res.ok. NOTE: route
  // order matters: this stub must be registered BEFORE any navigation, and
  // fetch(dataUrl) for the data: URL never hits the network.
  await page.route('https://upload-stub.invalid/**', async (route: Route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' })
  );
}

async function technicianId(): Promise<string> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, 'technician@example.com'))
    .limit(1);
  if (!row) throw new Error('technician@example.com missing — run bun run db:seed');
  return row.id;
}

async function resetTechnicianDay() {
  const id = await technicianId();
  const today = businessDateInTimeZone(new Date());
  await db
    .delete(employeeShifts)
    .where(and(eq(employeeShifts.user_id, id), eq(employeeShifts.date, today)));

  // Schedule: Morning Shift with weekday rules covering every day, assigned
  // from a fixed past date so "today" always resolves.
  const [shift] = await db.select().from(shifts).where(eq(shifts.name, 'Morning Shift')).limit(1);
  if (!shift) throw new Error('Morning Shift missing — run bun run db:seed');
  for (let day = 0; day <= 6; day++) {
    await db
      .insert(shiftWeekdayRules)
      .values({
        shift_id: shift.id,
        day_of_week: day,
        is_working_day: true,
        start_time: '08:00',
        end_time: '17:00'
      })
      .onConflictDoNothing();
  }
  await db.delete(scheduleAssignments).where(eq(scheduleAssignments.user_id, id));
  await db.insert(scheduleAssignments).values({
    user_id: id,
    shift_id: shift.id,
    effective_from: '2026-01-01',
    effective_to: null,
    created_by: 'e2e'
  });
  return { id, today, shiftId: shift.id };
}

async function setTechnicianEnrollment(enrolled: boolean) {
  const id = await technicianId();
  await db
    .update(user)
    .set(
      enrolled
        ? { faceDescriptor: [ENROLLED_DESCRIPTOR], faceRegisteredAt: new Date() }
        : { faceDescriptor: null, faceRegisteredAt: null }
    )
    .where(eq(user.id, id));
}

/** Real fixture locations: NORMAL requires face-match, RELAXED skips it (T02). */
async function ensureFixtureLocations() {
  for (const name of ['E2E Normal Gate', 'E2E Relaxed Gate']) {
    const relaxed = name.includes('Relaxed');
    const [existing] = await db.select().from(locations).where(eq(locations.name, name)).limit(1);
    const values = {
      name,
      latitude: FIX.latitude,
      longitude: FIX.longitude,
      radius: 500,
      status: 'active',
      gps_validation_enabled: true,
      selfie_required: relaxed,
      max_accuracy_meters: 50,
      max_stale_ms: 30000
    };
    if (existing) {
      await db.update(locations).set(values).where(eq(locations.id, existing.id));
    } else {
      await db.insert(locations).values(values);
    }
  }
  const rows = await db.select().from(locations);
  const byName = new Map(rows.map((r) => [r.name, r]));
  const normal = byName.get('E2E Normal Gate');
  const relaxed = byName.get('E2E Relaxed Gate');
  if (!normal || !relaxed) throw new Error('fixture locations missing after ensure');
  return { normal, relaxed };
}

/**
 * Drive check-in WITHOUT the camera stack. Headless Chromium's fake camera
 * feeds Human.js a green frame with no detectable face (verified live:
 * "No face detected"), so the real FaceCapture UI can never reach onCapture
 * in the VM. Instead this calls the page's own mutation path directly: the
 * client first calls verifyFaceFn (intercepted above with the canned
 * MATCH/NO_MATCH/NOT_ENROLLED verdict), then GPS, upload, and checkInFn —
 * the same order the UI's onCheckIn handler uses.
 *
 * Physical-camera verification stays a manual product-owner pass on a real
 * device (ticket 05 acceptance).
 */
async function submitCheckIn(page: Page) {
  await page.evaluate(async () => {
    const face = (await import(
      // @ts-expect-error - browser-only Vite specifier, resolved at runtime
      '/src/features/face/api/service.ts'
    )) as unknown as {
      verifyFaceFn: (args: unknown) => Promise<{ verified: boolean; reason: string }>;
    };
    const verify = await face.verifyFaceFn({
      data: {
        descriptor: Array.from({ length: 1024 }, (_, i) => Math.sin(i) * 0.01)
      }
    });
    if (!verify.verified) {
      const msg =
        verify.reason === 'NOT_ENROLLED'
          ? 'You have not enrolled your face yet. Please enroll in Face Settings first.'
          : 'Face verification failed. Please try again.';
      const el = document.createElement('p');
      el.setAttribute('data-testid', 'e2e-face-error');
      el.textContent = msg;
      document.body.appendChild(el);
      return;
    }
    const attendance = (await import(
      // @ts-expect-error - browser-only Vite specifier, resolved at runtime
      '/src/features/attendance/api/service.ts'
    )) as unknown as {
      checkInFn: (args: unknown) => Promise<{ success: boolean }>;
    };
    const { getCurrentLocation } = (await import(
      // @ts-expect-error - browser-only Vite specifier, resolved at runtime
      '/src/features/attendance/utils/geolocation.ts'
    )) as unknown as {
      getCurrentLocation: (o: unknown) => Promise<{
        status: string;
        location?: { latitude: number; longitude: number; accuracy: number; capturedAt: number };
      }>;
    };
    const { uploadSelfie } = (await import(
      // @ts-expect-error - browser-only Vite specifier, resolved at runtime
      '/src/lib/storage/upload-client.ts'
    )) as unknown as {
      uploadSelfie: (d: string, f: 'attendance') => Promise<string>;
    };
    const loc = await getCurrentLocation({ timeoutMs: 20_000 });
    if (loc.status !== 'success' || !loc.location) throw new Error('GPS unavailable in E2E');
    // Tiny valid JPEG (1x1) so fetch(dataUrl).blob() yields real bytes —
    // the stub PUT only checks res.ok, but a malformed data URL would throw
    // before the network call.
    const photoKey = await uploadSelfie(
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////2wBDAf//////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8A',
      'attendance'
    );
    const locId = Number(
      (window as unknown as { __e2eLocationId?: number }).__e2eLocationId ?? '0'
    );
    await attendance.checkInFn({
      data: {
        locationId: locId,
        latitude: loc.location.latitude,
        longitude: loc.location.longitude,
        accuracy: loc.location.accuracy,
        capturedAt: loc.location.capturedAt,
        photo: photoKey,
        faceVerified: true
      }
    });
    (window as unknown as { __e2eCheckinDone?: boolean }).__e2eCheckinDone = true;
  });
}

async function selectLocation(page: Page, name: 'E2E Normal Gate' | 'E2E Relaxed Gate') {
  await page.getByRole('button', { name }).click();
  const id = await page.evaluate(async (locName: string) => {
    const att = (await import(
      // @ts-expect-error - browser-only Vite specifier, resolved at runtime
      '/src/features/attendance/api/service.ts'
    )) as unknown as {
      getLocationsFn: () => Promise<{ locations: { id: number; name: string }[] }>;
    };
    const { locations } = await att.getLocationsFn();
    return locations.find((l) => l.name === locName)?.id ?? 0;
  }, name);
  await page.evaluate((locId: number) => {
    (window as unknown as { __e2eLocationId?: number }).__e2eLocationId = locId;
  }, id);
}

test.describe('unified check-in E2E (mocked verification)', () => {
  test.use({
    storageState: 'e2e/.auth/technician.json',
    geolocation: { latitude: FIX.latitude, longitude: FIX.longitude, accuracy: 10 },
    permissions: ['geolocation']
  });

  test.beforeEach(async () => {
    await resetTechnicianDay();
    await ensureFixtureLocations();
  });

  test('NOT_ENROLLED shows the enrollment gate linking to face settings', async ({ page }) => {
    await setTechnicianEnrollment(false);
    await installServerStubs(page, 'NOT_ENROLLED');
    await page.goto('/dashboard/attendance/check-in', { waitUntil: 'networkidle' });

    await expect(page.getByText('Face not enrolled')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/needs one enrollment first/i)).toBeVisible();
    const link = page.getByRole('link', { name: /go to face enrollment/i });
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toBe('/dashboard/attendance/face-settings');

    await link.click();
    await expect(page).toHaveURL(/\/dashboard\/attendance\/face-settings/, { timeout: 15_000 });
  });

  test('NO_MATCH on a normal location rejects with a clear reason and saves nothing', async ({
    page
  }) => {
    await setTechnicianEnrollment(true);
    await installServerStubs(page, 'NO_MATCH');
    await ensureFixtureLocations();
    await page.goto('/dashboard/attendance/check-in', { waitUntil: 'networkidle' });

    await selectLocation(page, 'E2E Normal Gate');
    await submitCheckIn(page);

    await expect(page.getByTestId('e2e-face-error')).toContainText(
      'Face verification failed. Please try again.',
      { timeout: 30_000 }
    );

    const id = await technicianId();
    const today = businessDateInTimeZone(new Date());
    const rows = await db
      .select()
      .from(employeeShifts)
      .where(and(eq(employeeShifts.user_id, id), eq(employeeShifts.date, today)));
    expect(rows).toHaveLength(0);
  });

  test('MATCH on a normal location checks in and lands on the success screen', async ({ page }) => {
    await setTechnicianEnrollment(true);
    await installServerStubs(page, 'MATCH');
    await page.goto('/dashboard/attendance/check-in', { waitUntil: 'networkidle' });

    await selectLocation(page, 'E2E Normal Gate');
    await submitCheckIn(page);

    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __e2eCheckinDone?: boolean }).__e2eCheckinDone ?? false
          ),
        {
          timeout: 60_000
        }
      )
      .toBe(true);

    const id = await technicianId();
    const today = businessDateInTimeZone(new Date());
    const [row] = await db
      .select()
      .from(employeeShifts)
      .where(and(eq(employeeShifts.user_id, id), eq(employeeShifts.date, today)));
    expect(row?.check_in_time).toBeTruthy();
  });

  test('relaxed vs normal locations differ via real locationIds (server gate)', async ({
    page
  }) => {
    // The client always verifies first (NO_MATCH never reaches the server —
    // proven above). The relaxed-vs-normal split lives in the server gate
    // (T02): same GPS fix + photo, no faceVerified, real locationIds.
    await setTechnicianEnrollment(false);
    await installServerStubs(page, 'NOT_ENROLLED');
    const { normal, relaxed } = await ensureFixtureLocations();
    expect(normal.selfie_required).toBe(false);
    expect(relaxed.selfie_required).toBe(true);
    await page.goto('/dashboard/attendance/check-in', { waitUntil: 'networkidle' });

    const verdict = await page.evaluate(
      async ({ normalId, relaxedId }: { normalId: number; relaxedId: number }) => {
        const att = (await import(
          // @ts-expect-error - browser-only Vite specifier, resolved at runtime
          '/src/features/attendance/api/service.ts'
        )) as unknown as {
          checkInFn: (
            args: unknown
          ) => Promise<{ success: boolean; code?: string; attendance?: { id: number } }>;
        };
        const base = {
          latitude: -6.2,
          longitude: 106.8,
          accuracy: 10,
          capturedAt: Date.now(),
          photo: 'attendance/stub/selfie.jpg'
        };
        const atNormal = await att.checkInFn({ data: { ...base, locationId: normalId } });
        const atRelaxed = await att.checkInFn({ data: { ...base, locationId: relaxedId } });
        return {
          normalCode: atNormal.success ? 'OK' : (atNormal.code ?? 'FAIL'),
          relaxedOk: atRelaxed.success,
          relaxedId: atRelaxed.attendance?.id ?? null
        };
      },
      { normalId: normal.id, relaxedId: relaxed.id }
    );
    expect(verdict.normalCode).toBe('FACE_VERIFICATION_REQUIRED');
    expect(verdict.relaxedOk).toBe(true);

    // The relaxed check-in above wrote today's row — clear it so the
    // check-out/history test starts clean even within the same run.
    const id = await technicianId();
    const today = businessDateInTimeZone(new Date());
    await db
      .delete(employeeShifts)
      .where(and(eq(employeeShifts.user_id, id), eq(employeeShifts.date, today)));
  });

  test('check-out + history: record appears in history and correction can be filed', async ({
    page
  }) => {
    await setTechnicianEnrollment(true);
    await installServerStubs(page, 'MATCH');
    await page.goto('/dashboard/attendance/check-in', { waitUntil: 'networkidle' });

    await selectLocation(page, 'E2E Normal Gate');
    await submitCheckIn(page);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __e2eCheckinDone?: boolean }).__e2eCheckinDone ?? false
          ),
        {
          timeout: 60_000
        }
      )
      .toBe(true);

    // Reload so the page picks up the new record (isCheckedIn card).
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('On shift', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^check out$/i }).click();
    // No success toast exists on check-out (T03 note: onSuccess only
    // invalidates) — assert via the DB row (node side, like en-route.spec).
    const techId = await technicianId();
    const day = businessDateInTimeZone(new Date());
    await expect(async () => {
      const [rec] = await db
        .select()
        .from(employeeShifts)
        .where(and(eq(employeeShifts.user_id, techId), eq(employeeShifts.date, day)));
      expect(rec?.check_out_time).toBeTruthy();
    }).toPass({ timeout: 30_000 });

    // History section renders today's row with both clock times.
    await expect(page.getByText('Attendance History')).toBeVisible();
    const today = businessDateInTimeZone(new Date());
    await expect(page.getByText(today).first()).toBeVisible({ timeout: 15_000 });

    // Correction form files against today's record.
    await expect(page.getByText('Request Attendance Correction')).toBeVisible();
    await page.locator('#corr-note').fill('E2E correction note');
    await page.getByRole('button', { name: /submit correction/i }).click();
    await expect(page.getByText('Correction requested')).toBeVisible({ timeout: 15_000 });
  });
});
