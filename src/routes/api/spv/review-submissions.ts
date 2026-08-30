import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/spv/review-submissions')({
  server: {
    handlers: {
      GET: async () => {
        const { requirePermission } = await import('@/lib/auth/session');
        const { checkRateLimit } = await import('@/lib/rate-limit');
        const { listMyReviewSubmissions, serializeReviewSubmissionRow } =
          await import('@/lib/db/checklists');
        try {
          const session = await requirePermission('checklist', 'approve');
          await checkRateLimit(`checklist:${session.user.id}`);
          const rows = await listMyReviewSubmissions(session.user.id);
          const submissions = rows.map(serializeReviewSubmissionRow);
          return new Response(JSON.stringify({ success: true, submissions }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Forbidden';
          const status = message.includes('Forbidden')
            ? 403
            : message.includes('Unauthorized')
              ? 401
              : 500;
          return new Response(JSON.stringify({ success: false, message }), {
            status,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
