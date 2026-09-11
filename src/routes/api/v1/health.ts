import { createFileRoute } from '@tanstack/react-router';

/**
 * Liveness/readiness probe for the platform in front of the app (systemd,
 * Caddy, and uptime monitors). Public by design and intentionally terse: it
 * returns no version, host, or error detail, only whether the database is
 * reachable. A 503 makes load balancers and `systemctl` health checks fail.
 */
export const Route = createFileRoute('/api/v1/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { client } = await import('@/lib/db');
          if (!client) throw new Error('database client unavailable');
          await client`SELECT 1`;
          return Response.json({ status: 'ok' });
        } catch {
          return Response.json({ status: 'unavailable' }, { status: 503 });
        }
      }
    }
  }
});
