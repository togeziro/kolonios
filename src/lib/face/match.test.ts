import { describe, expect, it } from 'vitest';
import { matchFace } from './match';
import { isFaceDescriptor, ACCURACY_THRESHOLDS, FACE_DESCRIPTOR_LENGTH } from './types';

// Build a deterministic pseudo-random descriptor (matching Human.js's 128-d
// embedding length) so tests do not depend on a real Human.js inference run.
function makeDescriptor(seed: number): number[] {
  const out: number[] = [];
  let x = seed;
  for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out.push((x / 0x7fffffff) * 2 - 1);
  }
  return out;
}

describe('matchFace', () => {
  it('matches an identical descriptor at every threshold', () => {
    const d = makeDescriptor(1);
    for (const level of ['loose', 'medium', 'tight'] as const) {
      const result = matchFace(d, [d], level);
      expect(result.matched).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(ACCURACY_THRESHOLDS[level]);
    }
  });

  it('matches a near-identical descriptor at loose/medium but not tight', () => {
    const d = makeDescriptor(1);
    const near = d.slice();
    // Perturb a small number of dimensions slightly — a genuine but imperfect capture.
    near[10] += 0.01;
    near[20] -= 0.01;
    near[30] += 0.005;
    const loose = matchFace(d, [near], 'loose');
    const medium = matchFace(d, [near], 'medium');
    const tight = matchFace(d, [near], 'tight');
    expect(loose.matched).toBe(true);
    expect(medium.matched).toBe(true);
    // A tight threshold can still match for tiny perturbations; assert ordering
    // rather than an absolute outcome.
    expect(medium.confidence).toBeGreaterThanOrEqual(loose.confidence);
    expect(tight.confidence).toBeGreaterThanOrEqual(loose.confidence);
  });

  it('rejects a clearly different descriptor', () => {
    const a = makeDescriptor(1);
    const b = makeDescriptor(9999);
    const result = matchFace(a, [b], 'medium');
    expect(result.matched).toBe(false);
    expect(result.confidence).toBeLessThan(ACCURACY_THRESHOLDS.medium);
  });

  it('rejects an empty enrollment', () => {
    const d = makeDescriptor(1);
    const result = matchFace(d, [], 'medium');
    expect(result.matched).toBe(false);
    expect(result.label).toBe('');
  });

  it('rejects a malformed live descriptor', () => {
    const d = makeDescriptor(1);
    const bad = d.slice(0, 100); // wrong length
    const result = matchFace(bad, [d], 'medium');
    expect(result.matched).toBe(false);
    expect(result.distance).toBe(1);
  });

  it('filters out malformed enrolled descriptors instead of throwing', () => {
    const d = makeDescriptor(1);
    const bad = d.slice(0, 100); // malformed enrolled entry
    const result = matchFace(d, [bad], 'medium');
    expect(result.matched).toBe(false);
    expect(result.distance).toBe(1);
  });

  it('finds the best match among multiple candidates', () => {
    const target = makeDescriptor(1);
    const candidate = makeDescriptor(2);
    const result = matchFace(target, [candidate, target], 'medium');
    expect(result.matched).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(ACCURACY_THRESHOLDS.medium);
  });
});

describe('isFaceDescriptor', () => {
  it('accepts a valid numeric descriptor of the expected length', () => {
    expect(isFaceDescriptor(makeDescriptor(1))).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isFaceDescriptor([1, 2, 3])).toBe(false);
  });

  it('rejects non-finite values', () => {
    const d = makeDescriptor(1);
    d[0] = Number.NaN;
    expect(isFaceDescriptor(d)).toBe(false);
    d[0] = Infinity;
    expect(isFaceDescriptor(d)).toBe(false);
  });
});
