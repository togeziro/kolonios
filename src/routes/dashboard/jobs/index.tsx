import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import JobsPage from '@/features/tickets/components/jobs-page';

const jobsSearchSchema = z.object({
  domain: z.enum(['field', 'backoffice']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
});

export const Route = createFileRoute('/dashboard/jobs/')({
  head: () => ({ meta: [{ title: 'Dashboard: Available Jobs' }] }),
  validateSearch: zodValidator(jobsSearchSchema),
  component: JobsPage
});
