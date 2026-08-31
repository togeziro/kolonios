export type BrandingSlot = 'logo_light' | 'logo_dark' | 'favicon';

export const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

export function toPngDataUrl(base64: string): string {
  return `${PNG_DATA_URL_PREFIX}${base64}`;
}

/** Returns the base64 payload when the value is a PNG data URL, else undefined. */
export function stripPngDataUrl(value: string | null | undefined): string | undefined {
  return value?.startsWith(PNG_DATA_URL_PREFIX)
    ? value.slice(PNG_DATA_URL_PREFIX.length)
    : undefined;
}

export interface SlotRequirement {
  maxBytes: number;
  minPx: number;
  maxPx: number;
}

export const BRANDING_SLOT_REQUIREMENTS: Record<BrandingSlot, SlotRequirement> = {
  logo_light: { maxBytes: 512 * 1024, minPx: 256, maxPx: 512 },
  logo_dark: { maxBytes: 512 * 1024, minPx: 256, maxPx: 512 },
  favicon: { maxBytes: 256 * 1024, minPx: 256, maxPx: 256 }
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export type BrandingValidationResult =
  | { ok: true; width: number; height: number }
  | {
      ok: false;
      reason: 'not_png' | 'too_large' | 'bad_dimensions' | 'malformed' | 'no_alpha';
    };

/**
 * Validates a branding image against its slot's requirements. Content is
 * inspected, not trusted: the PNG signature and IHDR dimensions are read
 * from the bytes themselves, so a mislabeled file cannot slip through.
 * Logos additionally require an alpha channel — the spec asks for
 * transparent backgrounds so the mark composites onto any shell.
 */
export function validateBrandingImage(
  slot: BrandingSlot,
  bytes: Uint8Array,
  contentType: string
): BrandingValidationResult {
  const requirement = BRANDING_SLOT_REQUIREMENTS[slot];
  if (contentType !== 'image/png') return { ok: false, reason: 'not_png' };
  if (bytes.length > requirement.maxBytes) return { ok: false, reason: 'too_large' };
  const isPng = PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  if (!isPng) return { ok: false, reason: 'not_png' };

  // IHDR chunk: 8-byte signature, 4-byte length, 4-byte "IHDR", then
  // width (offset 16) and height (offset 20) as big-endian uint32, color
  // type at offset 25. Color types with alpha: 4 (grayscale+alpha) and
  // 6 (truecolor+alpha); type 3 (palette) may still carry transparency
  // via tRNS, so only the RGB variants are rejected outright.
  if (bytes.length < 26) return { ok: false, reason: 'malformed' };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width !== height) return { ok: false, reason: 'bad_dimensions' };
  if (width < requirement.minPx || width > requirement.maxPx) {
    return { ok: false, reason: 'bad_dimensions' };
  }
  const colorType = bytes[25];
  const isLogo = slot !== 'favicon';
  if (isLogo && (colorType === 0 || colorType === 2)) {
    return { ok: false, reason: 'no_alpha' };
  }
  return { ok: true, width, height };
}

/** Decodes a base64 string to bytes; returns null when malformed. */
export function decodeBase64(base64: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
