import { describe, expect, it } from 'vitest';
import { legIdSchema, createTicketSchema, submitWorkSessionSchema } from './validation';

describe('tickets validation', () => {
  it('accepts positive integer leg ids and rejects everything else', () => {
    expect(legIdSchema.safeParse({ legId: 7 }).success).toBe(true);
    expect(legIdSchema.safeParse({ legId: 0 }).success).toBe(false);
    expect(legIdSchema.safeParse({ legId: -1 }).success).toBe(false);
    expect(legIdSchema.safeParse({ legId: 1.5 }).success).toBe(false);
  });

  it('caps createTicket legs at 10', () => {
    const base = { title: 'X' };
    const tooMany = Array.from({ length: 11 }, () => ({ name: 'leg' }));
    expect(createTicketSchema.safeParse({ ...base, legs: tooMany }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, legs: [{ name: 'Survey' }] }).success).toBe(
      true
    );
  });

  it('mirrors the channel enum for the form', () => {
    const ok = createTicketSchema.safeParse({ title: 'X', channel: 'whatsapp' });
    expect(ok.success).toBe(true);
    const bad = createTicketSchema.safeParse({ title: 'X', channel: 'fax' });
    expect(bad.success).toBe(false);
  });

  it('accepts the others catch-all for task type and channel', () => {
    const withOthers = createTicketSchema.safeParse({
      title: 'X',
      taskType: 'others',
      channel: 'others'
    });
    expect(withOthers.success).toBe(true);
  });
});

describe('submitWorkSessionSchema', () => {
  it('accepts a valid submit payload', () => {
    const result = submitWorkSessionSchema.safeParse({
      ticketId: 42,
      materials: [{ name: 'Drop cable', qty: 15, unit: 'm', source: 'van' }],
      photos: [{ fileUrl: 'tickets/0/123.jpg' }],
      notes: 'Replaced drop cable'
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty photos (at least one completion photo required)', () => {
    const result = submitWorkSessionSchema.safeParse({
      ticketId: 42,
      materials: [],
      photos: [],
      notes: ''
    });
    expect(result.success).toBe(false);
  });

  it('rejects a material with qty 0', () => {
    const result = submitWorkSessionSchema.safeParse({
      ticketId: 42,
      materials: [{ name: 'ONT', qty: 0, unit: '', source: 'van' }],
      photos: [{ fileUrl: 'tickets/0/1.jpg' }],
      notes: ''
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid material source', () => {
    const result = submitWorkSessionSchema.safeParse({
      ticketId: 42,
      materials: [{ name: 'ONT', qty: 1, unit: '', source: 'garage' }],
      photos: [{ fileUrl: 'tickets/0/1.jpg' }],
      notes: ''
    });
    expect(result.success).toBe(false);
  });
});
