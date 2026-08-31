import { describe, expect, it } from 'vitest';
import { updateBrandingSchema } from './validation';

describe('updateBrandingSchema', () => {
  it('accepts a profile-only save on a fresh database (no slots yet)', () => {
    const result = updateBrandingSchema.safeParse({
      profile: { name: 'PT Nusa', address: '', email: '', phone: '' }
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty optional email (common form payload)', () => {
    const result = updateBrandingSchema.safeParse({
      profile: { name: 'PT Nusa', email: '' }
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email format', () => {
    const result = updateBrandingSchema.safeParse({
      profile: { name: 'PT Nusa', email: 'not-an-email' }
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty company name', () => {
    const result = updateBrandingSchema.safeParse({
      profile: { name: '   ' }
    });
    expect(result.success).toBe(false);
  });

  it('accepts slot-only saves and null slots', () => {
    expect(
      updateBrandingSchema.safeParse({
        logoLight: 'data:image/png;base64,AAA',
        profile: { name: 'PT Nusa' }
      }).success
    ).toBe(true);
    expect(
      updateBrandingSchema.safeParse({
        logoLight: null,
        profile: { name: 'PT Nusa' }
      }).success
    ).toBe(true);
  });

  it('bounds slot payload size', () => {
    const huge = `data:image/png;base64,${'A'.repeat(1024 * 1024 + 1)}`;
    const result = updateBrandingSchema.safeParse({
      logoLight: huge,
      profile: { name: 'PT Nusa' }
    });
    expect(result.success).toBe(false);
  });
});
