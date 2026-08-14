import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  checkRateLimit: vi.fn(),
  startLeg: vi.fn(),
  getCompletedTickets: vi.fn()
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
  startLeg: mocks.startLeg,
  getCompletedTickets: mocks.getCompletedTickets
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

serverFnProvider.handler = startLegFn_createServerFn_handler;

import { startLegFn, getCompletedTicketsFn } from './service';

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
