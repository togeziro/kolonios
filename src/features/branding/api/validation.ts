import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value == null ? undefined : value),
    z.string().trim().max(max).optional()
  );

export const brandingProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: optionalText(255),
  email: z.preprocess(
    (value) => (value === '' || value == null ? undefined : value),
    z.string().trim().email().max(100).optional()
  ),
  phone: optionalText(30)
});

// Per-slot data-URL cap: 512 KB logo → ~700 KB base64; favicon is smaller.
// Content (magic bytes, dimensions) is validated in the server fn via
// validateBrandingImage — the schema only bounds the transport shape.
export const brandingSlotSchema = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
  .max(1024 * 1024)
  .nullable();

export const updateBrandingSchema = z.object({
  logoLight: brandingSlotSchema.optional(),
  logoDark: brandingSlotSchema.optional(),
  favicon: brandingSlotSchema.optional(),
  profile: brandingProfileSchema
});

export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
export type BrandingProfileInput = z.infer<typeof brandingProfileSchema>;
