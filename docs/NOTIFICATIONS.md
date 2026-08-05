# Notifications — Delivery Mechanism

## Current design (2026-07-31)

Delivery is **client polling via TanStack Query**:

- `notificationListQueryOptions()` (`src/features/notifications/api/queries.ts`)
  sets `refetchInterval: 30_000`, `refetchIntervalInBackground: false`,
  `refetchOnWindowFocus: 'always'`, `staleTime: 15_000`.
- Mutations invalidate `notificationKeys.all` immediately, so the badge
  updates as soon as the user marks/removes/adds a notification.
- Worst-case badge latency: ~30 s (one poll interval). No server push.

Rationale: TanStack ecosystem guidance is progressive enhancement — polling
integrates with caching, stale-while-revalidate, and focus refetching; no new
protocol or dependency is required for badge-style updates. This matches the
polling cadence used in the MIKCYBERLTE reference project (30–60 s
`setInterval`).

## SSE upgrade path (when to switch)

Switch to Server-Sent Events when a workflow requires **sub-second** delivery
(e.g. leave-approval push, live ticket updates):

1. Add `GET /api/v1/notifications/stream` returning `text/event-stream`
   (Nitro `ReadableStream`), authenticated like other server functions.
2. Client: `EventSource` with reconnect + `Last-Event-ID`; on `message`
   call `queryClient.invalidateQueries({ queryKey: notificationKeys.all })`.
3. Keep the query options as the fallback (polls resume when the stream
   drops) — polling stays as the resilience layer.
4. WebSocket is only justified for bidirectional flows (chat, live editing);
   not needed for notifications.

## Reference

- Server functions: `src/features/notifications/api/service.ts`
- DB layer: `src/lib/db/notifications.ts` (rows are user-scoped via `user_id`)
