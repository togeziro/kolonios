import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  checkRateLimit: vi.fn(),
  getMyTickets: vi.fn(),
  listOpenTickets: vi.fn(),
  getTicketDetail: vi.fn(),
  takeTicket: vi.fn(),
  completeTicket: vi.fn(),
  createTicket: vi.fn(),
  startLeg: vi.fn(),
  getCompletedTickets: vi.fn(),
  submitWorkSession: vi.fn(),
  addHandoffNote: vi.fn(),
  reviewTicket: vi.fn(),
  listSubmittedTickets: vi.fn(),
  claimLeg: vi.fn(),
  listRelayPool: vi.fn()
}));

// The split query supplies the production provider handler behind each exported
// server-function caller, avoiding a network request while retaining its boundary.
// The ssr-rpc mock funnels every caller through the single `serverFnProvider.handler`,
// pointed at the split handler below.
const serverFnProvider = vi.hoisted(() => ({
  handler: undefined as ((options: { data: unknown }) => unknown) | undefined
}));

vi.mock('@/lib/auth/session', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/db/tickets', () => ({
  getMyTickets: mocks.getMyTickets,
  listOpenTickets: mocks.listOpenTickets,
  getTicketDetail: mocks.getTicketDetail,
  takeTicket: mocks.takeTicket,
  completeTicket: mocks.completeTicket,
  createTicket: mocks.createTicket,
  startLeg: mocks.startLeg,
  getCompletedTickets: mocks.getCompletedTickets,
  submitWorkSession: mocks.submitWorkSession,
  addHandoffNote: mocks.addHandoffNote,
  reviewTicket: mocks.reviewTicket,
  listSubmittedTickets: mocks.listSubmittedTickets,
  claimLeg: mocks.claimLeg,
  listRelayPool: mocks.listRelayPool
}));
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator: { parse(input: unknown): unknown } | undefined;
    const builder = {
      validator(nextValidator: { parse(input: unknown): unknown }) {
        validator = nextValidator;
        return builder;
      },
      handler(...handlers: Array<(context: { data: unknown }) => unknown>) {
        const nextHandler = handlers.at(-1)!;
        const invoke = async (options: { data: unknown }) =>
          nextHandler({ data: validator ? validator.parse(options.data) : options.data });
        return Object.assign(invoke, { __executeServer: invoke });
      }
    };
    return builder;
  }
}));
vi.mock('@tanstack/react-start/server-rpc', () => ({
  createServerRpc: (_meta: unknown, fn: (options: unknown) => unknown) => fn
}));
vi.mock('@tanstack/react-start/ssr-rpc', () => ({
  createSsrRpc: () => (options: { data: unknown }) => serverFnProvider.handler!(options)
}));

// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { startLegFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { getCompletedTicketsFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { getMyTicketsFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { listOpenTicketsFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { getTicketDetailFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { takeTicketFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { completeTicketFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { createTicketFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { submitWorkSessionFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { submitHandoffNoteFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { reviewTicketFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { listSubmittedTicketsFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { claimLegFn_createServerFn_handler } from './service?tss-serverfn-split';
// @ts-expect-error TanStack Start's provider query is a Vite-only module id.
import { listRelayPoolFn_createServerFn_handler } from './service?tss-serverfn-split';

serverFnProvider.handler = startLegFn_createServerFn_handler;

import {
  startLegFn,
  getCompletedTicketsFn,
  getMyTicketsFn,
  listOpenTicketsFn,
  getTicketDetailFn,
  takeTicketFn,
  completeTicketFn,
  createTicketFn,
  submitWorkSessionFn,
  submitHandoffNoteFn,
  reviewTicketFn,
  listSubmittedTicketsFn,
  claimLegFn,
  listRelayPoolFn
} from './service';

describe('startLegFn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('guards with tickets.edit permission and a write rate limit', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.startLeg.mockResolvedValue({ success: true });
    const res = await startLegFn({ data: { legId: 3 } } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('tickets', 'edit');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('write:u1');
    expect(mocks.startLeg).toHaveBeenCalledWith('u1', 3);
    expect(res).toEqual({ success: true });
  });
});

describe('getCompletedTicketsFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = getCompletedTicketsFn_createServerFn_handler;
  });

  it('guards with my_work.view permission and fetches the user completed tickets', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.getCompletedTickets.mockResolvedValue({ success: true, tickets: [] });
    const res = await getCompletedTicketsFn({} as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('my_work', 'view');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('tickets:u1');
    expect(mocks.getCompletedTickets).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ success: true, tickets: [] });
  });
});

describe('getMyTicketsFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = getMyTicketsFn_createServerFn_handler;
  });

  it('guards with my_work.view permission and fetches the user active tickets', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.getMyTickets.mockResolvedValue({ success: true, tickets: [] });
    const res = await getMyTicketsFn({} as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('my_work', 'view');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('tickets:u1');
    expect(mocks.getMyTickets).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ success: true, tickets: [] });
  });
});

describe('listOpenTicketsFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = listOpenTicketsFn_createServerFn_handler;
  });

  it('guards with jobs.view permission and passes filters through', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.listOpenTickets.mockResolvedValue({ success: true, tickets: [] });
    const res = await listOpenTicketsFn({ data: { domain: 'field' } } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('jobs', 'view');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('tickets:u1');
    expect(mocks.listOpenTickets).toHaveBeenCalledWith('u1', { domain: 'field' });
    expect(res).toEqual({ success: true, tickets: [] });
  });
});

describe('getTicketDetailFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = getTicketDetailFn_createServerFn_handler;
  });

  it('guards with tickets.view permission and fetches a ticket by id', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.getTicketDetail.mockResolvedValue({ success: true });
    const res = await getTicketDetailFn({ data: { ticketId: 7 } } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('tickets', 'view');
    expect(mocks.getTicketDetail).toHaveBeenCalledWith('u1', 7);
    expect(res).toEqual({ success: true });
  });
});

describe('takeTicketFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = takeTicketFn_createServerFn_handler;
  });

  it('guards with tickets.edit permission and a write rate limit', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.takeTicket.mockResolvedValue({ success: true });
    const res = await takeTicketFn({ data: { ticketId: 9 } } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('tickets', 'edit');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('write:u1');
    expect(mocks.takeTicket).toHaveBeenCalledWith('u1', 9);
    expect(res).toEqual({ success: true });
  });
});

describe('claimLegFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = claimLegFn_createServerFn_handler;
  });

  it('guards with tickets.edit permission and a write rate limit', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.claimLeg.mockResolvedValue({ success: true });
    const res = await claimLegFn({ data: { legId: 4 } } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('tickets', 'edit');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('write:u1');
    expect(mocks.claimLeg).toHaveBeenCalledWith('u1', 4);
    expect(res).toEqual({ success: true });
  });
});

describe('listRelayPoolFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = listRelayPoolFn_createServerFn_handler;
  });

  it('guards with jobs.view permission and passes filters through', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.listRelayPool.mockResolvedValue({ success: true, tickets: [], unavailable: [] });
    const res = await listRelayPoolFn({ data: { domain: 'field' } } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('jobs', 'view');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('tickets:u1');
    expect(mocks.listRelayPool).toHaveBeenCalledWith('u1', { domain: 'field' });
    expect(res).toEqual({ success: true, tickets: [], unavailable: [] });
  });
});

describe('completeTicketFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = completeTicketFn_createServerFn_handler;
  });

  it('guards with tickets.edit permission and completes a ticket', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.completeTicket.mockResolvedValue({ success: true });
    const res = await completeTicketFn({ data: { ticketId: 11 } } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('tickets', 'edit');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('write:u1');
    expect(mocks.completeTicket).toHaveBeenCalledWith('u1', 11);
    expect(res).toEqual({ success: true });
  });
});

describe('createTicketFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = createTicketFn_createServerFn_handler;
  });

  it('guards with tickets.add permission and creates a ticket from input', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.createTicket.mockResolvedValue({ success: true });
    const res = await createTicketFn({
      data: { title: 'Install OLT', taskType: 'installation' }
    } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('tickets', 'add');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('write:u1');
    expect(mocks.createTicket).toHaveBeenCalledWith('u1', {
      title: 'Install OLT',
      taskType: 'installation'
    });
    expect(res).toEqual({ success: true });
  });
});

describe('submitWorkSessionFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = submitWorkSessionFn_createServerFn_handler;
  });

  it('guards with tickets.edit + write rate limit and passes the worklog through', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.submitWorkSession.mockResolvedValue({ success: true, isLastLeg: false, nextLeg: null });
    const input = {
      ticketId: 7,
      materials: [],
      photos: [{ fileUrl: 'tickets/0/1.jpg' }],
      notes: '',
      log: [{ kind: 'note', body: 'Done' }]
    };
    const res = await submitWorkSessionFn({ data: input } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('tickets', 'edit');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('write:u1');
    expect(mocks.submitWorkSession).toHaveBeenCalledWith('u1', 7, {
      materials: input.materials,
      photos: input.photos,
      notes: input.notes,
      log: input.log
    });
    expect(res).toEqual({ success: true, isLastLeg: false, nextLeg: null });
  });
});

describe('submitHandoffNoteFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = submitHandoffNoteFn_createServerFn_handler;
  });

  it('guards with tickets.edit + write rate limit and appends the handoff note', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.addHandoffNote.mockResolvedValue({ success: true });
    const res = await submitHandoffNoteFn({ data: { legId: 3, note: 'Send courier' } } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('tickets', 'edit');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('write:u1');
    expect(mocks.addHandoffNote).toHaveBeenCalledWith('u1', 3, 'Send courier');
    expect(res).toEqual({ success: true });
  });
});

describe('reviewTicketFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = reviewTicketFn_createServerFn_handler;
  });

  it('guards with spv_review.edit + write rate limit and passes the review through', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.reviewTicket.mockResolvedValue({ success: true });
    const res = await reviewTicketFn({
      data: { ticketId: 12, decision: 'approved', notes: 'OK' }
    } as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('spv_review', 'edit');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('write:u1');
    expect(mocks.reviewTicket).toHaveBeenCalledWith('u1', 12, 'approved', 'OK');
    expect(res).toEqual({ success: true });
  });
});

describe('listSubmittedTicketsFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnProvider.handler = listSubmittedTicketsFn_createServerFn_handler;
  });

  it('guards with spv_review.view permission and fetches submitted tickets', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'u1' } });
    mocks.listSubmittedTickets.mockResolvedValue({ success: true, tickets: [] });
    const res = await listSubmittedTicketsFn({} as never);
    expect(mocks.requirePermission).toHaveBeenCalledWith('spv_review', 'view');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('tickets:u1');
    expect(mocks.listSubmittedTickets).toHaveBeenCalledWith();
    expect(res).toEqual({ success: true, tickets: [] });
  });
});
