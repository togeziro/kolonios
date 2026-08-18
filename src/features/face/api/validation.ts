import { z } from 'zod';
import { FACE_DESCRIPTOR_LENGTH } from '@/lib/face/types';

export const faceDescriptorSchema = z
  .array(z.number().finite())
  .length(FACE_DESCRIPTOR_LENGTH, `Face descriptor must be ${FACE_DESCRIPTOR_LENGTH} dimensions`);

export const faceEnrollmentSchema = z.object({
  descriptors: z
    .array(faceDescriptorSchema)
    .min(1, 'At least one face descriptor is required')
    .max(5, 'Too many face descriptors')
});

export const faceVerifySchema = z.object({
  descriptor: faceDescriptorSchema,
  antiSpoofScore: z.number().min(0).max(1).optional(),
  livenessScore: z.number().min(0).max(1).optional()
});

export const faceSettingsSchema = z.object({
  validationMode: z.enum(['realtime', 'background']),
  accuracyLevel: z.enum(['loose', 'medium', 'tight']),
  showSeconds: z.boolean()
});

export type FaceEnrollmentInput = z.infer<typeof faceEnrollmentSchema>;
export type FaceVerifyInput = z.infer<typeof faceVerifySchema>;
export type FaceSettingsInput = z.infer<typeof faceSettingsSchema>;
