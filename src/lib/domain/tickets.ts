import type {
  TicketStatus,
  TicketLegStatus,
  TicketPriority,
  TicketChannel,
  TicketTaskType,
  TicketWorklogKind
} from '@/lib/db/schema/tickets';

export type {
  TicketStatus,
  TicketLegStatus,
  TicketPriority,
  TicketChannel,
  TicketTaskType,
  TicketWorklogKind
};

export type TicketDomain = 'field' | 'backoffice';

export type TicketReviewDecision = 'approved' | 'rejected';

export type Ticket = {
  id: number;
  ticketCode: string | null;
  title: string;
  description: string;
  channel: TicketChannel;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    address: string;
    latitude: number;
    longitude: number;
  } | null;
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
  takenByName: string | null;
  takenAt: string | null;
  rating: number | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  completedAt: string | null;
  createdByName: string | null;
  createdAt: string;
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

export type TicketMaterial = {
  id: number;
  legId: number;
  legName: string;
  materialName: string;
  qty: number;
  unit: string;
  source: 'warehouse' | 'van';
  barcode: string;
};

export type TicketPhoto = {
  id: number;
  legId: number;
  fileUrl: string;
  caption: string;
};

export type TicketLogEntry = {
  id: number;
  legId: number;
  kind: TicketWorklogKind;
  body: string;
  createdAt: string;
  createdBy: string | null;
};

export type WorkLogEntryInput = {
  kind: TicketWorklogKind;
  body: string;
};

export type WorkSessionMaterialInput = {
  name: string;
  qty: number;
  unit: string;
  source: 'warehouse' | 'van';
};

export type WorkSessionPhotoInput = {
  fileUrl: string;
};

export type WorkSessionSubmitInput = {
  materials: WorkSessionMaterialInput[];
  photos: WorkSessionPhotoInput[];
  notes: string;
  log: WorkLogEntryInput[];
};

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

export type NextLegInfo = {
  legNumber: number;
  name: string;
};

export type TicketDetail = Ticket & {
  legs: TicketLeg[];
  materials: TicketMaterial[];
  photos: TicketPhoto[];
  worklog: TicketLogEntry[];
  requesterId: string | null;
  createdAt: string;
};

export type UnavailableTicket = Ticket & { eligibilityReasons: string[] };

export type TicketListFilters = {
  domain?: TicketDomain;
  priority?: TicketPriority;
  status?: TicketStatus;
};

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
  nextLeg?: NextLegInfo | null;
  isLastLeg?: boolean;
};

export type CreateTicketResponse = TicketDetailResponse;
export type TicketPhotoInput = { fileUrl: string };
