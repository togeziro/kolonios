import type {
  TicketStatus,
  TicketLegStatus,
  TicketPriority,
  TicketChannel,
  TicketTaskType
} from '@/lib/db/schema/tickets';

export type { TicketStatus, TicketLegStatus, TicketPriority, TicketChannel, TicketTaskType };

export type TicketDomain = 'field' | 'backoffice';

export type Ticket = {
  id: number;
  ticketCode: string | null;
  title: string;
  description: string;
  channel: TicketChannel;
  customer: { id: string; name: string } | null;
  assetName: string;
  taskType: TicketTaskType;
  domain: TicketDomain;
  status: TicketStatus;
  priority: TicketPriority;
  location: { id: number; name: string } | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  requiredSkills: string[];
  assignedTo: string | null;
  takenBy: string | null;
  completedAt: string | null;
};

export type TicketLeg = {
  id: number;
  legNumber: number;
  name: string;
  description: string;
  status: TicketLegStatus;
  assigneeId: string | null;
  takenAt: string | null;
  completedAt: string | null;
  notes: string;
};

export type TicketDetail = Ticket & {
  legs: TicketLeg[];
  requesterId: string | null;
  createdAt: string;
};

export type UnavailableTicket = Ticket & { eligibilityReasons: string[] };

export type TicketListResponse = {
  success: boolean;
  tickets: Ticket[];
  unavailable: UnavailableTicket[];
};

export type TicketDetailResponse = {
  success: boolean;
  ticket?: TicketDetail;
  message?: string;
};

export type TicketActionResponse = {
  success: boolean;
  message?: string;
  ticket?: Ticket;
};

export type CreateTicketResponse = TicketDetailResponse;

export type NewLegInput = { name: string; description?: string };

export type NewTicketInput = {
  title: string;
  description?: string;
  channel?: TicketChannel;
  customerId?: string;
  assetName?: string;
  taskType?: TicketTaskType;
  priority?: TicketPriority;
  locationId?: number;
  dueAt?: string;
  estimatedMinutes?: number;
  legs?: NewLegInput[];
};

export type TicketListFilters = {
  domain?: TicketDomain;
  priority?: TicketPriority;
};
