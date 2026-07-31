import { describe, expect, it } from 'vitest';
import { addNotificationSchema, markAsReadSchema, removeNotificationSchema } from './validation';

describe('notification validation', () => {
  it('accepts string ids and coerces to positive integers', () => {
    expect(markAsReadSchema.parse({ id: '42' })).toEqual({ id: 42 });
    expect(removeNotificationSchema.parse({ id: '7' })).toEqual({ id: 7 });
    expect(() => markAsReadSchema.parse({ id: '0' })).toThrow();
    expect(() => markAsReadSchema.parse({ id: 'abc' })).toThrow();
  });

  it('requires title and body on add', () => {
    expect(() => addNotificationSchema.parse({ title: '', body: 'x' })).toThrow();
    expect(addNotificationSchema.parse({ title: 't', body: 'b' })).toMatchObject({
      title: 't',
      body: 'b'
    });
  });
});
