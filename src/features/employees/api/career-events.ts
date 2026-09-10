import { createServerFn } from '@tanstack/react-start';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { lengthOfService, type CareerEventRow } from '@/lib/career-timeline/engine';
import type { CareerEvent as DbCareerEvent } from '@/lib/db/schema/employee-career-events';

const employeeIdSchema = z.string().min(1).max(64);

// Per-category append payload. `start_work` is intentionally rejected on
// the wire — only the seed migration creates these rows (ADR-0007).
const employmentStatusEnum = z.enum(['active', 'probation', 'resigned', 'terminated']);

const appendCareerEventSchema = z.discriminatedUnion('category', [
  z.object({
    category: z.literal('position'),
    employeeId: employeeIdSchema,
    toDesignationId: z.coerce.number().int().positive(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveDate must be YYYY-MM-DD'),
    notes: z.string().nullable().optional()
  }),
  z.object({
    category: z.literal('division'),
    employeeId: employeeIdSchema,
    toDepartmentId: z.coerce.number().int().positive(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveDate must be YYYY-MM-DD'),
    notes: z.string().nullable().optional()
  }),
  z.object({
    category: z.literal('employment_status'),
    employeeId: employeeIdSchema,
    toLabel: employmentStatusEnum,
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveDate must be YYYY-MM-DD'),
    notes: z.string().nullable().optional()
  })
]);

export type AppendCareerEventPayload = z.infer<typeof appendCareerEventSchema>;

const deleteCareerEventSchema = z.object({
  eventId: z.coerce.number().int().positive()
});

export type CareerTimelineEvent = {
  id: number;
  category: DbCareerEvent['category'];
  effective_date: string;
  notes: string | null;
  actor_user_id: string | null;
  from_designation_id: number | null;
  to_designation_id: number | null;
  from_department_id: number | null;
  to_department_id: number | null;
  from_label: string | null;
  to_label: string;
  created_at: string;
  updated_at: string;
};

export type CareerTimeline = {
  lengthOfService: string;
  events: CareerTimelineEvent[];
};

export const getCareerTimelineFn = createServerFn({ method: 'GET' })
  .validator(employeeIdSchema)
  .handler(async ({ data: employeeId }): Promise<CareerTimeline> => {
    await requirePermission('employees', 'view');
    const [{ getEmployeeById }, { listCareerEventsForEmployee }] = await Promise.all([
      import('@/lib/db/employees'),
      import('@/lib/db/career-timeline')
    ]);
    const employeeResult = await getEmployeeById(employeeId);
    const events = await listCareerEventsForEmployee(employeeId);
    const length =
      employeeResult?.success && employeeResult.employee
        ? lengthOfService(employeeResult.employee.join_date, new Date())
        : '0 Month';
    return {
      lengthOfService: length,
      events: events.map(serialize)
    };
  });

/**
 * Append one Career Event for one employee. Guarded by `employees.edit`;
 * rejects any caller without that permission. Performs the dual-write
 * (event row + employees column) inside one DB transaction.
 *
 * Per category the payload differs (see `appendCareerEventSchema`). The
 * `from_*` snapshot is resolved server-side from the employee's current
 * row and the target masterdata row — the dialog does not send it.
 */
export const appendCareerEventFn = createServerFn({ method: 'POST' })
  .validator(zodValidator(appendCareerEventSchema))
  .handler(async ({ data }) => {
    const session = await requirePermission('employees', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { appendCareerEvent } = await import('@/lib/db/career-timeline');

    const notes = data.notes ?? null;

    if (data.category === 'position') {
      return serialize(
        await appendCareerEvent({
          category: 'position',
          employeeId: data.employeeId,
          toDesignationId: data.toDesignationId,
          effectiveDate: data.effectiveDate,
          notes,
          actorUserId: session.user.id
        })
      );
    }
    if (data.category === 'division') {
      return serialize(
        await appendCareerEvent({
          category: 'division',
          employeeId: data.employeeId,
          toDepartmentId: data.toDepartmentId,
          effectiveDate: data.effectiveDate,
          notes,
          actorUserId: session.user.id
        })
      );
    }
    return serialize(
      await appendCareerEvent({
        category: 'employment_status',
        employeeId: data.employeeId,
        toLabel: data.toLabel,
        effectiveDate: data.effectiveDate,
        notes,
        actorUserId: session.user.id
      })
    );
  });

function serialize(row: DbCareerEvent): CareerTimelineEvent {
  return {
    id: row.id,
    category: row.category,
    effective_date: row.effective_date,
    notes: row.notes,
    actor_user_id: row.actor_user_id,
    from_designation_id: row.from_designation_id,
    to_designation_id: row.to_designation_id,
    from_department_id: row.from_department_id,
    to_department_id: row.to_department_id,
    from_label: row.from_label,
    to_label: row.to_label,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
}

export const careerEventsKeys = {
  all: ['careerEvents'] as const,
  timeline: (employeeId: string) => [...careerEventsKeys.all, 'timeline', employeeId] as const
};

export const careerTimelineQueryOptions = (employeeId: string) =>
  queryOptions({
    queryKey: careerEventsKeys.timeline(employeeId),
    queryFn: () => getCareerTimelineFn({ data: employeeId })
  });

/**
 * Hook used by the Career Timeline dialog. Calls the server fn, then
 * invalidates the per-employee timeline query so the UI re-renders with
 * the new event at the top.
 */
export function useAppendCareerEvent(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AppendCareerEventPayload) => appendCareerEventFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerEventsKeys.timeline(employeeId) });
    }
  });
}

/**
 * Hard-delete one Career Event within its 5-minute correction window. Guarded
 * by `employees.edit`; the DB helper additionally enforces the window, the
 * same-actor rule, and that system-seeded rows (NULL actor) stay undeletable.
 * Rejects with the `CAREER_EVENT_DELETE_FORBIDDEN` domain code otherwise.
 *
 * Only the event row is removed — the matching `employees` column is NOT
 * reverted (the employee record is the source of truth; ADR-0007).
 */
export const deleteCareerEventFn = createServerFn({ method: 'POST' })
  .validator(zodValidator(deleteCareerEventSchema))
  .handler(async ({ data }) => {
    const session = await requirePermission('employees', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { deleteCareerEvent } = await import('@/lib/db/career-timeline');
    return deleteCareerEvent(data.eventId, session.user.id);
  });

/**
 * Hook used by the timeline card's delete confirmation. Calls the server fn,
 * then invalidates every Career Timeline query so the deleted event drops out
 * of the rendered timeline.
 */
export function useDeleteCareerEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: number) => deleteCareerEventFn({ data: { eventId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerEventsKeys.all });
    }
  });
}

// Re-export the engine row type so feature consumers have one name to
// reach for; the wire boundary uses `CareerTimelineEvent` (Date fields
// ISO-stringified) but the engine also accepts the raw DB row shape.
export type { CareerEventRow as CareerEvent };
