import { createFileRoute } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import KanbanViewPage from '@/features/kanban/components/kanban-view-page';
import { boardQueryOptions } from '@/features/kanban/api/queries';

export const Route = createFileRoute('/dashboard/kanban')({
  head: () => ({ meta: [{ title: 'Dashboard : Kanban view' }] }),
  ssr: 'data-only',
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(boardQueryOptions());
  },
  component: () => <KanbanViewPage />
});
