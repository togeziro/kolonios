// TODO(wire): local fixtures for the SPV Review Queue. Replace with a
// reviewer-scoped listing server function once it exists (ADR-0002: the queue
// reviews Daily Checklist submissions only; time log, tasks-logged count,
// note and photos are read-only day context, never the approval target).
export type ReviewQueueSubmission = {
  id: string;
  ticketId?: number;
  technicianName: string;
  scheduleWindow: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  itemsResolved: number;
  itemsTotal: number;
  tasksLogged: number;
  note: string;
  photos: { id: number; url: string }[];
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  decidedBy?: string;
  decidedAt?: string;
};

export const REVIEW_QUEUE_SUBMISSIONS: ReviewQueueSubmission[] = [
  {
    id: 'sub-101',
    ticketId: 1042,
    technicianName: 'Alex Kim',
    scheduleWindow: 'Wed, Aug 12 · 08:00 - 17:00',
    clockInAt: '08:05',
    clockOutAt: '16:48',
    itemsResolved: 6,
    itemsTotal: 6,
    tasksLogged: 2,
    note: 'Installed fiber drop at Jl. Melati. Signal strength tested OK.',
    photos: [
      { id: 1, url: '/fixtures/checklist-drop-cable.jpg' },
      { id: 2, url: '/fixtures/checklist-odp-final.jpg' }
    ],
    status: 'pending'
  },
  {
    id: 'sub-102',
    ticketId: 1087,
    technicianName: 'Rina Wijaya',
    scheduleWindow: 'Wed, Aug 12 · 09:00 - 18:00',
    clockInAt: '08:55',
    clockOutAt: '18:15',
    itemsResolved: 4,
    itemsTotal: 4,
    tasksLogged: 1,
    note: 'Routine maintenance at server room B. AC unit filters replaced.',
    photos: [{ id: 3, url: '/fixtures/checklist-server-room.jpg' }],
    status: 'pending'
  },
  {
    id: 'sub-103',
    technicianName: 'Joko Prasetyo',
    scheduleWindow: 'Tue, Aug 11 · 08:00 - 17:00',
    clockInAt: '07:58',
    clockOutAt: '17:02',
    itemsResolved: 6,
    itemsTotal: 6,
    tasksLogged: 3,
    note: 'Full route inspection completed, no anomalies found.',
    photos: [],
    status: 'approved',
    decidedBy: 'SPV_01',
    decidedAt: 'Aug 11, 18:30'
  },
  {
    id: 'sub-104',
    technicianName: 'Sari Indah',
    scheduleWindow: 'Mon, Aug 10 · 07:00 - 16:00',
    clockInAt: '07:12',
    clockOutAt: null,
    itemsResolved: 3,
    itemsTotal: 6,
    tasksLogged: 1,
    note: 'Rain stopped work after lunch.',
    photos: [],
    status: 'rejected',
    rejectionReason: 'Missing photo evidence for task #4092.'
  }
];
