import {
  ACCURACY_THRESHOLDS,
  isFaceDescriptor,
  type FaceAccuracyLevel,
  type FaceMatchResult
} from './types';

/**
 * Face descriptor matching — pure implementation of Human.js's official
 * `match.find` algorithm (verified against v3.3.6 dist source):
 * - `distance`: Euclidean (order 2) with multiplier 25, rounded to 2 decimals
 * - `similarity`: normalized 0..1 from distance (root/100, min 0.2, max 0.8)
 *
 * Human.js cannot be imported on the server in this app: its node entry pulls
 * `@tensorflow/tfjs-node` (not installed) and `vite.config.ts` mocks the
 * `@vladmandic/human` specifier in server bundles. Matching is pure math, so
 * reimplementing the official algorithm keeps verification server-side while
 * staying behaviorally identical to `human.match.find`.
 */

type MatchOptions = {
  order?: number;
  multiplier?: number;
  min?: number;
  max?: number;
};

function distance(
  descriptor1: number[],
  descriptor2: number[],
  options: MatchOptions = {}
): number {
  const order = options.order ?? 2;
  const multiplier = options.multiplier ?? 25;
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff =
      !order || order === 2
        ? descriptor1[i] - descriptor2[i]
        : Math.abs(descriptor1[i] - descriptor2[i]);
    sum += !order || order === 2 ? diff * diff : diff ** order;
  }
  return Math.round(100 * multiplier * sum) / 100;
}

function normalizeDistance(dist: number, order: number, min: number, max: number): number {
  if (dist === 0) return 1;
  const root = order === 2 ? Math.sqrt(dist) : dist ** (1 / order);
  const norm = (1 - root / 100 - min) / (max - min);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}

function find(
  descriptor: number[],
  descriptors: number[][],
  options: MatchOptions = {}
): { index: number; distance: number; similarity: number } {
  if (
    !Array.isArray(descriptor) ||
    !Array.isArray(descriptors) ||
    descriptor.length < 64 ||
    descriptors.length === 0
  ) {
    return { index: -1, distance: Number.POSITIVE_INFINITY, similarity: 0 };
  }
  const order = options.order ?? 2;
  const min = options.min ?? 0.2;
  const max = options.max ?? 0.8;
  let lowestDistance = Number.MAX_SAFE_INTEGER;
  let bestIndex = -1;
  for (let i = 0; i < descriptors.length; i++) {
    const d =
      descriptors[i].length === descriptor.length
        ? distance(descriptor, descriptors[i], options)
        : Number.MAX_SAFE_INTEGER;
    if (d < lowestDistance) {
      lowestDistance = d;
      bestIndex = i;
    }
  }
  return {
    index: bestIndex,
    distance: lowestDistance,
    similarity: normalizeDistance(lowestDistance, order, min, max)
  };
}

/**
 * Matches a live descriptor against enrolled descriptors using Human.js's
 * official `match.find` algorithm. `similarity` >= the configured threshold
 * decides the match (Human guidance: above 0.5 can be considered a match).
 */
export function matchFace(
  liveDescriptor: number[],
  enrolledDescriptors: number[][],
  accuracyLevel: FaceAccuracyLevel = 'medium'
): FaceMatchResult {
  const threshold = ACCURACY_THRESHOLDS[accuracyLevel];

  if (!enrolledDescriptors || enrolledDescriptors.length === 0) {
    return { matched: false, label: '', distance: 1, confidence: 0 };
  }

  if (!isFaceDescriptor(liveDescriptor)) {
    return { matched: false, label: '', distance: 1, confidence: 0 };
  }

  const valid = enrolledDescriptors.filter(isFaceDescriptor);
  if (valid.length === 0) {
    return { matched: false, label: '', distance: 1, confidence: 0 };
  }

  const best = find(liveDescriptor, valid);

  const matched = best.index >= 0 && best.similarity >= threshold;

  return {
    matched,
    label: matched ? `descriptor_${best.index}` : '',
    distance: best.distance,
    confidence: best.similarity
  };
}
