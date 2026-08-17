import { match } from '@vladmandic/human';
import { ACCURACY_THRESHOLDS, type FaceMatchResult } from './types';

export function matchFace(
  liveDescriptor: number[],
  enrolledDescriptors: number[][],
  accuracyLevel: 'loose' | 'medium' | 'tight' = 'medium'
): FaceMatchResult {
  const threshold = ACCURACY_THRESHOLDS[accuracyLevel];

  if (!enrolledDescriptors || enrolledDescriptors.length === 0) {
    return { matched: false, label: '', distance: 1, confidence: 0 };
  }

  const best = match.find(liveDescriptor, enrolledDescriptors);

  const matched = best.index >= 0 && best.similarity >= threshold;

  return {
    matched,
    label: matched ? `descriptor_${best.index}` : '',
    distance: best.distance,
    confidence: best.similarity
  };
}
