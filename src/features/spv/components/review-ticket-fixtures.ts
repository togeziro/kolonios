// TODO(wire): local fixtures for the SPV Review Ticket detail screen.
// Shapes mirror the ticket domain types (src/lib/domain/tickets.ts
// TicketPhoto/TicketMaterial). Replace with a reviewer-scoped submitted-ticket
// fetch once it exists. This lifecycle is DISTINCT from the Daily Checklist
// Review Queue (ADR-0002) — never merge the two surfaces.
export type ReviewEvidencePhoto = {
  id: number;
  url: string;
  caption?: string;
};

export type ReviewMaterial = {
  id: number;
  name: string;
  quantity: string;
};

export type ReviewableTicket = {
  id: number;
  code: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  requesterName: string;
  requesterInitials: string;
  address: string;
  legsCompleted: number;
  legsTotal: number;
  engineerName: string;
  engineerRole: string;
  photos: ReviewEvidencePhoto[];
  workSummary: string;
  materials: ReviewMaterial[];
  sopResolved: number;
  sopTotal: number;
};

export const REVIEWABLE_TICKETS: ReviewableTicket[] = [
  {
    id: 1042,
    code: 'T-1042',
    title: 'Instalasi FTTH — Budi Santoso',
    priority: 'high',
    requesterName: 'Sales Hub',
    requesterInitials: 'SH',
    address: 'Jl. Merdeka No. 45, Jakarta Selatan',
    legsCompleted: 4,
    legsTotal: 4,
    engineerName: 'Dedi',
    engineerRole: 'Technician',
    photos: [
      { id: 1, url: '/fixtures/ticket-1042-redaman.jpg', caption: 'Optical power meter' },
      { id: 2, url: '/fixtures/ticket-1042-ont.jpg', caption: 'Installed ONT' }
    ],
    workSummary:
      'Instalasi selesai sesuai prosedur. Sinyal optik berada di -18dBm, stabil. Pelanggan sudah tes koneksi dan puas.',
    materials: [
      { id: 1, name: 'Drop Cable 1 Core', quantity: '150m' },
      { id: 2, name: 'Fiber Connector SC/UPC', quantity: '2 pcs' }
    ],
    sopResolved: 6,
    sopTotal: 6
  },
  {
    id: 1087,
    code: 'T-1087',
    title: 'Maintenance Server Room B',
    priority: 'medium',
    requesterName: 'Operations',
    requesterInitials: 'OP',
    address: 'Jl. Gatot Subroto No. 12, Jakarta Selatan',
    legsCompleted: 1,
    legsTotal: 3,
    engineerName: 'Rina',
    engineerRole: 'Technician',
    photos: [{ id: 3, url: '/fixtures/ticket-1087-ac-filter.jpg' }],
    workSummary: 'AC filter replaced and temperature normalized to 22°C.',
    materials: [{ id: 3, name: 'AC Filter 24 inch', quantity: '1 pcs' }],
    sopResolved: 4,
    sopTotal: 4
  }
];
