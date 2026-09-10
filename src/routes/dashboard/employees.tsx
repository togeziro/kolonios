import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * Layout route for `/dashboard/employees*`. The list renders in
 * `employees.index.tsx` (exact `/dashboard/employees`) and the detail
 * screen in `employees/$id.tsx` — this route only carries the shared head
 * meta and the <Outlet/> so the list never fetches while the detail page
 * is mounted (ticket 04 E2E: list → open one employee).
 */
export const Route = createFileRoute('/dashboard/employees')({
  head: () => ({ meta: [{ title: 'Dashboard: Employees' }] }),
  component: () => <Outlet />
});
