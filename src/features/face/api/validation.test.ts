import { describe, expect, it } from 'vitest';
import { faceEnrollmentSchema, faceVerifySchema, faceSettingsSchema } from './validation';

function makeDescriptor(): number[] {
  return Array.from({ length: 512 }, (_, i) => Math.sin(i) * 0.5);
}

describe('face validation schemas', () => {
  describe('faceEnrollmentSchema', () => {
    it('accepts 1-5 valid descriptors', () => {
      expect(faceEnrollmentSchema.safeParse({ descriptors: [makeDescriptor()] }).success).toBe(
        true
      );
      expect(
        faceEnrollmentSchema.safeParse({
          descriptors: [makeDescriptor(), makeDescriptor(), makeDescriptor()]
        }).success
      ).toBe(true);
    });

    it('rejects empty enrollment', () => {
      expect(faceEnrollmentSchema.safeParse({ descriptors: [] }).success).toBe(false);
    });

    it('rejects more than 5 descriptors', () => {
      expect(
        faceEnrollmentSchema.safeParse({
          descriptors: Array.from({ length: 6 }, () => makeDescriptor())
        }).success
      ).toBe(false);
    });

    it('rejects descriptors with the wrong length', () => {
      const bad = makeDescriptor().slice(0, 100);
      expect(faceEnrollmentSchema.safeParse({ descriptors: [bad] }).success).toBe(false);
    });

    it('rejects non-finite descriptor values', () => {
      const bad = makeDescriptor();
      bad[0] = Number.NaN;
      expect(faceEnrollmentSchema.safeParse({ descriptors: [bad] }).success).toBe(false);
    });
  });

  describe('faceVerifySchema', () => {
    it('accepts a descriptor with optional scores', () => {
      expect(faceVerifySchema.safeParse({ descriptor: makeDescriptor() }).success).toBe(true);
      expect(
        faceVerifySchema.safeParse({
          descriptor: makeDescriptor(),
          antiSpoofScore: 0.8,
          livenessScore: 0.7
        }).success
      ).toBe(true);
    });

    it('rejects out-of-range scores', () => {
      expect(
        faceVerifySchema.safeParse({
          descriptor: makeDescriptor(),
          antiSpoofScore: 1.5
        }).success
      ).toBe(false);
    });
  });

  describe('faceSettingsSchema', () => {
    it('accepts valid settings', () => {
      expect(
        faceSettingsSchema.safeParse({
          validationMode: 'realtime',
          accuracyLevel: 'tight',
          showSeconds: true
        }).success
      ).toBe(true);
    });

    it('rejects invalid enum values', () => {
      expect(
        faceSettingsSchema.safeParse({
          validationMode: 'async',
          accuracyLevel: 'medium',
          showSeconds: false
        }).success
      ).toBe(false);
    });
  });
});
