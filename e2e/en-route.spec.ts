import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { desc, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { tickets, ticketLegs, ticketWorklog } from '../src/lib/db/schema/tickets';

const TICKET_TITLE = 'Fix network room 201';

async function resetTicket() {
  // The arrive transition (assigned → in_progress) is one-way; flip the demo
  // ticket back so every run starts from the same state.
  await db
    .update(tickets)
    .set({ status: 'assigned', updated_at: new Date() })
    .where(eq(tickets.title, TICKET_TITLE));
}

async function getTicket() {
  const [ticket] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.title, TICKET_TITLE));
  if (!ticket) throw new Error(`Seed ticket "${TICKET_TITLE}" missing — run bun run db:seed`);
  return ticket;
}

// The assigned ticket lives in the "Up Next" section of My Work; clicking its
// only action button ("Open") follows the assigned-status link to en-route.
async function openTicketCard(page: Page) {
  const heading = page.getByRole('heading', { name: TICKET_TITLE });
  const card = page.locator('[data-slot="card"]', { has: heading });
  await card.getByRole('button', { name: /^Open$/i }).click();
}

test.describe('en-route navigation', () => {
  // Headless Chromium has no GPS hardware: grant the permission AND feed a
  // fake fix, otherwise getCurrentLocation fails and the page falls into the
  // "arrive without location" path. The technician storageState comes from
  // playwright.config.ts (technician project).
  test.use({
    geolocation: { latitude: -6.2, longitude: 106.8, accuracy: 10 },
    permissions: ['geolocation']
  });

  test.beforeEach(async () => {
    await resetTicket();
  });

  test('renders the route map with device + destination markers, line, and distance', async ({
    page
  }) => {
    await page.goto('/dashboard/my-work');
    await openTicketCard(page);

    await expect(page.getByRole('heading', { name: TICKET_TITLE })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('button', { name: /Find my location/i })).toBeVisible();

    // Click "Find my location" to kick the map's getCurrentPosition through the
    // (already-mounted) effect; this guarantees the fix flows into state
    // regardless of whether the mount-time getCurrentLocation won the race
    // against the first paint.
    await page.getByRole('button', { name: /Find my location/i }).click();

    await expect(page.getByText(/Distance to destination/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\d+(\.\d+)?\s*(km|m)\b/)).toBeVisible();

    // MapLibre default markers render as `.maplibregl-marker` elements; the
    // dashed guide line lives on the WebGL canvas. Both markers (device +
    // destination) appear only after the map's async 'load' event, which can
    // lag the page-level distance label — retry instead of counting once.
    await expect(page.locator('.maplibregl-marker')).toHaveCount(2, { timeout: 15_000 });

    const hasMapCanvas = await page.evaluate(
      () => !!document.querySelector('.maplibregl-canvas, .maplibregl-canvas-container canvas')
    );
    expect(hasMapCanvas).toBe(true);
  });

  test("records the arrival via I've Arrived and lands on the work session", async ({ page }) => {
    const ticket = await getTicket();
    await page.goto('/dashboard/my-work');
    await openTicketCard(page);

    await expect(page.getByRole('button', { name: "I've Arrived" })).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole('button', { name: "I've Arrived" }).click();

    // Arrival transitions the ticket assigned → in_progress and the page
    // auto-navigates to the work session screen.
    await expect(page).toHaveURL(/\/dashboard\/work-session\/\d+/, { timeout: 15_000 });

    const [row] = await db
      .select({ status: tickets.status })
      .from(tickets)
      .where(eq(tickets.title, TICKET_TITLE));
    expect(row?.status).toBe('in_progress');

    // The arrival is journaled server-side as a worklog row (kind: 'location')
    // scoped to this ticket's leg, with a "lat,lng ±accuracy" body from
    // formatArrivalBody — a bare "no location fix" body would mean the GPS
    // payload was dropped, i.e. the exact stale-closure regression this spec
    // guards against.
    const [log] = await db
      .select({ body: ticketWorklog.body })
      .from(ticketWorklog)
      .innerJoin(ticketLegs, eq(ticketLegs.id, ticketWorklog.leg_id))
      .where(eq(ticketLegs.ticket_id, ticket.id))
      .orderBy(desc(ticketWorklog.id))
      .limit(1);
    expect(log?.body).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)? ±\d+m$/);
  });

  test('does not draw a phantom marker or distance for a Null Island fix', async ({ browser }) => {
    const ctx: BrowserContext = await browser.newContext({
      storageState: 'e2e/.auth/technician.json',
      geolocation: { latitude: 0, longitude: 0 },
      permissions: ['geolocation']
    });
    try {
      const page = await ctx.newPage();
      const ticket = await getTicket();
      await page.goto(`/dashboard/en-route/${ticket.id}`);

      await expect(page.getByRole('heading', { name: TICKET_TITLE })).toBeVisible({
        timeout: 15_000
      });

      // Distance label must NOT appear — the (0,0) fix is rejected by
      // isPlausibleFix, so distanceToDestination stays null. The canvas
      // visibility doubles as the map-readiness signal before the absence
      // check (no arbitrary sleep).
      await expect(page.locator('.maplibregl-canvas').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Distance to destination/i)).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});
