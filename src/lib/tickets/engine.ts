// Pure ticket-domain logic: serialization (row -> API shape), domain
// classification, and eligibility rules. No DB, no IO, no clock — every
// function here is deterministic given its inputs and unit-testable without
// fixtures. Persistence lives in @/lib/db/tickets, which feeds these
// functions the rows they need.
import type {
  TicketChannel,
  TicketLegStatus,
  TicketPriority,
  TicketStatus,
  TicketTaskType,
  TicketWorklogKind,
  Ticket,
  TicketLeg,
  TicketMaterial,
  TicketLogEntry
} from '@/lib/domain/tickets';

// --- Shared constants ---

export const MAX_ACTIVE_TICKETS = 3;

export const FIELD_TASK_TYPES = ['installation', 'maintenance', 'inspection'] as const;

export function domainOf(taskType: string): 'field' | 'backoffice' {
  return (FIELD_TASK_TYPES as readonly string[]).includes(taskType) ? 'field' : 'backoffice';
}

// --- Row shapes (structural subsets of the drizzle tables) ---

export type TicketRow = {
  id: number;
  ticket_code: string | null;
  title: string;
  description: string;
  channel: TicketChannel;
  asset_name: string;
  task_type: TicketTaskType;
  status: TicketStatus;
  priority: TicketPriority;
  due_at: Date | null;
  estimated_minutes: number | null;
  assigned_to: string | null;
  taken_by: string | null;
  taken_at: Date | null;
  rating: number | null;
  review_note: string;
  reviewed_by: string | null;
  completed_at: Date | null;
  created_at: Date;
};

export type LegRow = {
  id: number;
  leg_number: number;
  name: string;
  description: string;
  status: TicketLegStatus;
  assignee_id: string | null;
  taken_at: Date | null;
  completed_at: Date | null;
  notes: string;
};

export type MaterialRow = {
  id: number;
  leg_id: number;
  material_name: string;
  qty: number;
  unit: string;
  source: 'warehouse' | 'van';
  barcode: string;
};

export type WorklogRow = {
  id: number;
  leg_id: number;
  kind: TicketWorklogKind;
  body: string;
  created_at: Date;
  created_by: string | null;
};

export type CustomerInfo = {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  latitude: number;
  longitude: number;
};

export type LocationInfo = { id: number; name: string };

export type RequirementRow = {
  department_id: number | null;
  designation_id: number | null;
  location_id: number | null;
  skill: string | null;
};

// --- Eligibility (pure) ---

export type EligibilityProfile = {
  status: string | null;
  department_id: number | null;
  designation_id: number | null;
  location_id: number | null;
  skills: string[];
};

export function unmetRequirementReasons(
  requirements: RequirementRow[],
  profile: EligibilityProfile
): string[] {
  const reasons: string[] = [];
  if (profile.status !== 'active') {
    reasons.push('Your account is not active');
  }
  for (const r of requirements) {
    if (r.department_id != null && profile.department_id !== r.department_id) {
      reasons.push('Requires a different department');
    }
    if (r.designation_id != null && profile.designation_id !== r.designation_id) {
      reasons.push('Requires a different designation');
    }
    if (r.location_id != null && profile.location_id !== r.location_id) {
      reasons.push('Outside your assigned location');
    }
    if (r.skill != null && !profile.skills.includes(r.skill)) {
      reasons.push(`Requires skill: ${r.skill}`);
    }
  }
  return [...new Set(reasons)];
}

// --- Serialization (pure) ---

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function ticketToDomain(
  row: TicketRow,
  requirements: RequirementRow[],
  deps: {
    customer: CustomerInfo | null;
    location: LocationInfo | null;
    creatorName?: string | null;
    takenByName?: string | null;
  }
): Ticket {
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    title: row.title,
    description: row.description,
    channel: row.channel,
    customer: deps.customer,
    assetName: row.asset_name,
    taskType: row.task_type,
    domain: domainOf(row.task_type),
    status: row.status,
    priority: row.priority,
    location: deps.location,
    dueAt: iso(row.due_at),
    estimatedMinutes: row.estimated_minutes,
    requiredSkills: requirements.map((r) => r.skill).filter((s): s is string => s != null),
    assignedTo: row.assigned_to,
    takenBy: row.taken_by,
    takenByName: deps.takenByName ?? null,
    takenAt: iso(row.taken_at),
    rating: row.rating ?? null,
    reviewNote: row.review_note || null,
    reviewedBy: row.reviewed_by,
    completedAt: iso(row.completed_at),
    createdByName: deps.creatorName ?? null,
    createdAt: row.created_at.toISOString()
  };
}

export function legToDomain(row: LegRow): TicketLeg {
  return {
    id: row.id,
    legNumber: row.leg_number,
    name: row.name,
    description: row.description,
    status: row.status,
    assigneeId: row.assignee_id,
    takenAt: iso(row.taken_at),
    completedAt: iso(row.completed_at),
    notes: row.notes
  };
}

export function materialToDomain(row: MaterialRow, legName: string): TicketMaterial {
  return {
    id: row.id,
    legId: row.leg_id,
    legName,
    materialName: row.material_name,
    qty: row.qty,
    unit: row.unit,
    source: row.source,
    barcode: row.barcode
  };
}

export function worklogToDomain(row: WorklogRow): TicketLogEntry {
  return {
    id: row.id,
    legId: row.leg_id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by
  };
}

// --- Work-session workflow (pure) ---

const SUBMITTABLE_LEG_STATUSES = ['open', 'assigned', 'in_progress'];
const ADVANCEABLE_LEG_STATUSES = ['open', 'assigned'];

// Mirrors the historical SQL ordering: in-progress legs first (lowest number),
// then everything else by leg number; the winner must still be submittable.
// Filtering first would change behavior — a submitted leg blocks re-submission
// even when later legs are still open.
export function pickSubmittableLeg(legs: LegRow[]): LegRow | null {
  if (legs.length === 0) return null;
  const sorted = [...legs].sort(
    (a, b) =>
      Number(b.status === 'in_progress') - Number(a.status === 'in_progress') ||
      a.leg_number - b.leg_number
  );
  const leg = sorted[0];
  return SUBMITTABLE_LEG_STATUSES.includes(leg.status) ? leg : null;
}

export function resolveSubmittedNotes(existingNotes: string, submittedNotes: string): string {
  return submittedNotes ? submittedNotes : existingNotes;
}

export type LegAdvanceOutcome =
  | { kind: 'advance'; nextLeg: { id: number; legNumber: number; name: string } }
  | { kind: 'complete' };

export function resolveLegAdvance(submittedLegNumber: number, legs: LegRow[]): LegAdvanceOutcome {
  const next = legs
    .filter((l) => l.leg_number > submittedLegNumber && ADVANCEABLE_LEG_STATUSES.includes(l.status))
    .sort((a, b) => a.leg_number - b.leg_number)[0];
  if (!next) return { kind: 'complete' };
  return {
    kind: 'advance',
    nextLeg: { id: next.id, legNumber: next.leg_number, name: next.name }
  };
}

// A leg is claimable from the relay pool only when it is the *nearest* next leg:
// status `assigned`, no assignee yet (it entered the pool via resolveLegAdvance),
// and every earlier leg has been submitted (sequential — no parallel work).
// An earlier open/in_progress/claimed leg blocks all later legs, so a non-sequential
// leg (e.g. leg 3 while leg 2 is unfinished) is never claimable.
export function pickClaimableLeg(legs: LegRow[]): LegRow | null {
  const sorted = [...legs].sort((a, b) => a.leg_number - b.leg_number);
  for (const l of sorted) {
    if (l.status === 'submitted' || l.status === 'completed') continue;
    if (l.status === 'assigned' && l.assignee_id === null) return l;
    return null;
  }
  return null;
}

export function formatHandoffNote(existingNotes: string, note: string): string {
  return existingNotes ? `${existingNotes}\nHandoff: ${note}` : `Handoff: ${note}`;
}

export function formatArrivalBody(location?: {
  latitude: number;
  longitude: number;
  accuracy: number;
}): string {
  return location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ? `${location.latitude},${location.longitude} ±${location.accuracy}m`
    : 'arrived (no location fix)';
}

// --- Completion guard (pure) — 1 foto per ticket, enforced both client & server ---

export function canCompleteTicket(args: {
  domain: 'field' | 'backoffice';
  isAdmin: boolean;
  photoCount: number;
}): { allowed: boolean; reason?: 'requiresPhoto' | 'requiresReview' } {
  // Field tickets must go via Work Session → submitted → SPV review → completed.
  // Direct Mark Complete is only for admin/backoffice shortcut, but still needs photo.
  if (args.photoCount < 1) return { allowed: false, reason: 'requiresPhoto' };
  if (args.domain === 'field' && !args.isAdmin) {
    return { allowed: false, reason: 'requiresReview' };
  }
  return { allowed: true };
}

export function workSessionSubmitAllowed(args: {
  existingPhotoCount: number;
  inputPhotoCount: number;
}): { allowed: boolean; reason?: 'requiresPhoto' } {
  // 1 foto per ticket: first submit needs ≥1 new photo; later legs may submit without new photo if ticket already has one.
  if (args.existingPhotoCount === 0 && args.inputPhotoCount < 1) {
    return { allowed: false, reason: 'requiresPhoto' };
  }
  return { allowed: true };
}

// --- Detail-page leg action (pure) ---

export type DetailLegAction =
  | { kind: 'start-leg'; legId: number }
  | { kind: 'claim-leg'; legId: number; reasons: string[] }
  | { kind: 'none' };

/**
 * Decides which primary action the ticket detail page should offer for the
 * viewer. The holder starts the next leg; a non-holder may only claim the
 * nearest relay-pool leg (with eligibility reasons surfaced when blocked).
 * Open tickets use the separate Take flow and are `none` here.
 */
export function resolveDetailLegAction(args: {
  status: TicketStatus;
  isHolder: boolean;
  startableLegId: number | null;
  claimableLegId: number | null;
  claimEligibilityReasons: string[];
}): DetailLegAction {
  if (args.status === 'open') return { kind: 'none' };
  if (args.isHolder) {
    return args.startableLegId != null
      ? { kind: 'start-leg', legId: args.startableLegId }
      : { kind: 'none' };
  }
  return args.claimableLegId != null
    ? { kind: 'claim-leg', legId: args.claimableLegId, reasons: args.claimEligibilityReasons }
    : { kind: 'none' };
}
