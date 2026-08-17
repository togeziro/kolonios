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
  error?: string;
}

export interface FaceConfig {
  validationMode: 'realtime' | 'background';
  accuracyLevel: 'loose' | 'medium' | 'tight';
  showSeconds: boolean;
}

export const ACCURACY_THRESHOLDS = {
  loose: 0.4,
  medium: 0.6,
  tight: 0.8
} as const;
