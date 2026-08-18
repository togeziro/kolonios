export interface FaceDescriptor {
  label: string;
  descriptors: number[][];
}

export interface FaceMatchResult {
  matched: boolean;
  label: string;
  distance: number;
  confidence: number;
}

export interface FaceDetectionResult {
  detected: boolean;
  descriptor: number[] | null;
  antiSpoofScore: number | null;
  livenessScore: number | null;
  detectionScore?: number | null;
  error?: string;
}

export interface FaceConfig {
  validationMode: 'realtime' | 'background';
  accuracyLevel: 'loose' | 'medium' | 'tight';
  showSeconds: boolean;
}

export type FaceAccuracyLevel = 'loose' | 'medium' | 'tight';
export type FaceValidationMode = 'realtime' | 'background';

// Human's own guidance: similarity above 0.5 can be considered a match.
// Loose/medium/tight map to 0.4/0.6/0.8 (default medium = 0.6).
export const ACCURACY_THRESHOLDS: Record<FaceAccuracyLevel, number> = {
  loose: 0.4,
  medium: 0.6,
  tight: 0.8
} as const;

// Human.js face descriptor output with the bundled `faceres` (ArcFace-style)
// model is 1024-d. (The 128-d mobilefacenet path is only used when an
// alternative descriptor model is explicitly configured.)
export const FACE_DESCRIPTOR_LENGTH = 1024;

export function isFaceDescriptor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === FACE_DESCRIPTOR_LENGTH &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}
