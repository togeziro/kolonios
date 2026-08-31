import { describe, expect, it } from 'vitest';
import { validateBrandingImage, BRANDING_SLOT_REQUIREMENTS, type BrandingSlot } from './assets';

// 1x1 transparent PNG with a valid IHDR declaring 1x1 (patched per test).
const PNG_1X1 = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82
]);

const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe('BRANDING_SLOT_REQUIREMENTS', () => {
  it('exposes per-slot requirements matching the agreed spec', () => {
    const slots = Object.keys(BRANDING_SLOT_REQUIREMENTS) as BrandingSlot[];
    expect(slots).toEqual(['logo_light', 'logo_dark', 'favicon']);
    expect(BRANDING_SLOT_REQUIREMENTS.logo_light.maxBytes).toBe(512 * 1024);
    expect(BRANDING_SLOT_REQUIREMENTS.favicon.maxBytes).toBe(256 * 1024);
    expect(BRANDING_SLOT_REQUIREMENTS.favicon.minPx).toBe(256);
    expect(BRANDING_SLOT_REQUIREMENTS.favicon.maxPx).toBe(256);
  });
});

describe('validateBrandingImage', () => {
  // Logo fixture at the minimum accepted size.
  const PNG_256 = PNG_1X1.slice();
  new DataView(PNG_256.buffer).setUint32(16, 256);
  new DataView(PNG_256.buffer).setUint32(20, 256);

  it('accepts a valid PNG with declared contentType', () => {
    const result = validateBrandingImage('logo_light', PNG_256, 'image/png');
    expect(result).toEqual({ ok: true, width: 256, height: 256 });
  });

  it('rejects when the file is not a PNG by magic bytes regardless of declared type', () => {
    expect(validateBrandingImage('logo_light', JPEG_BYTES, 'image/jpeg').ok).toBe(false);
  });

  it('rejects when declared contentType is not image/png', () => {
    expect(validateBrandingImage('logo_light', PNG_256, 'image/jpeg').ok).toBe(false);
  });

  it('rejects a file exceeding the slot size limit', () => {
    const big = new Uint8Array(600 * 1024);
    big.set(PNG_1X1.subarray(0, 8));
    const result = validateBrandingImage('logo_light', big, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_large');
  });

  it('rejects a favicon that is not exactly 256x256', () => {
    const PNG_300 = PNG_1X1.slice();
    const view300 = new DataView(PNG_300.buffer);
    view300.setUint32(16, 300);
    view300.setUint32(20, 300);
    const result = validateBrandingImage('favicon', PNG_300, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_dimensions');
  });

  it('rejects a non-square logo', () => {
    // IHDR patched to declare 300x200.
    const wide = PNG_1X1.slice();
    const view = new DataView(wide.buffer);
    view.setUint32(16, 300);
    view.setUint32(20, 200);
    const result = validateBrandingImage('logo_light', wide, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_dimensions');
  });

  it('accepts a 256x256 favicon and 512x512 logo', () => {
    const square256 = PNG_1X1.slice();
    let view = new DataView(square256.buffer);
    view.setUint32(16, 256);
    view.setUint32(20, 256);
    expect(validateBrandingImage('favicon', square256, 'image/png').ok).toBe(true);

    const square512 = PNG_1X1.slice();
    view = new DataView(square512.buffer);
    view.setUint32(16, 512);
    view.setUint32(20, 512);
    expect(validateBrandingImage('logo_light', square512, 'image/png').ok).toBe(true);
  });

  const square256 = PNG_1X1.slice();
  new DataView(square256.buffer).setUint32(16, 256);
  new DataView(square256.buffer).setUint32(20, 256);

  it('rejects a logo without an alpha channel (color type 2, truecolor)', () => {
    const opaque = square256.slice();
    // Color type lives at IHDR offset 25; 2 = truecolor (no alpha).
    opaque[25] = 2;
    const result = validateBrandingImage('logo_light', opaque, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_alpha');
  });

  it('accepts a favicon without an alpha channel (transparency not required)', () => {
    const opaque = square256.slice();
    opaque[25] = 2;
    expect(validateBrandingImage('favicon', opaque, 'image/png').ok).toBe(true);
  });

  it('accepts a palette logo (color type 3 may carry tRNS transparency)', () => {
    const palette = square256.slice();
    palette[25] = 3;
    expect(validateBrandingImage('logo_dark', palette, 'image/png').ok).toBe(true);
  });
});
