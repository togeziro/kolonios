import { describe, expect, it } from 'vitest';
import {
  legIdSchema,
  createTicketSchema,
  submitWorkSessionSchema,
  submitHandoffNoteSchema
} from './validation';

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

describe('submitWorkSessionSchema log', () => {
  const base = () => ({
    ticketId: 42,
    materials: [],
    photos: [{ fileUrl: 'tickets/0/1.jpg' }],
    notes: ''
  });

  it('accepts an empty log (defaults to [])', () => {
    const res = submitWorkSessionSchema.safeParse(base());
    expect(res.success).toBe(true);
    expect(res.data?.log).toEqual([]);
  });

  it('accepts up to 50 valid log entries', () => {
    const log = Array.from({ length: 50 }, () => ({ kind: 'note' as const, body: 'x' }));
    expect(submitWorkSessionSchema.safeParse({ ...base(), log }).success).toBe(true);
  });

  it('rejects a log with more than 50 entries', () => {
    const log = Array.from({ length: 51 }, () => ({ kind: 'note' as const, body: 'x' }));
    expect(submitWorkSessionSchema.safeParse({ ...base(), log }).success).toBe(false);
  });

  it('rejects an invalid log kind', () => {
    expect(
      submitWorkSessionSchema.safeParse({ ...base(), log: [{ kind: 'voice', body: 'x' }] }).success
    ).toBe(false);
  });

  it('rejects an oversize log body', () => {
    expect(
      submitWorkSessionSchema.safeParse({
        ...base(),
        log: [{ kind: 'note', body: 'x'.repeat(501) }]
      }).success
    ).toBe(false);
  });
});

describe('submitHandoffNoteSchema', () => {
  it('accepts a valid leg id and note', () => {
    expect(submitHandoffNoteSchema.safeParse({ legId: 7, note: 'Pick up at 3pm' }).success).toBe(
      true
    );
  });

  it('rejects a bad leg id or oversize note', () => {
    expect(submitHandoffNoteSchema.safeParse({ legId: 0, note: '' }).success).toBe(false);
    expect(submitHandoffNoteSchema.safeParse({ legId: 1, note: 'x'.repeat(2001) }).success).toBe(
      false
    );
  });
});
