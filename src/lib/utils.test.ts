import { afterEach, describe, expect, it, vi } from 'vitest';
import { cn, formatBytes, generateId } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', null, undefined, false, 'b')).toBe('a b');
  });

  it('resolves tailwind conflicts with twMerge', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('generateId', () => {
  it('returns a UUID when crypto.randomUUID is available', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(generateId()).not.toBe(id);
  });

  it('falls back to a random hex string when crypto.randomUUID is missing', () => {
    vi.stubGlobal('crypto', undefined);
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe('formatBytes', () => {
  it('handles zero', () => {
    expect(formatBytes(0)).toBe('0 Byte');
  });

  it('formats with the normal size names', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('formats with accurate size names', () => {
    expect(formatBytes(1024 * 1024, { sizeType: 'accurate' })).toBe('1 MiB');
  });

  it('honors decimals', () => {
    expect(formatBytes(1536, { decimals: 1 })).toBe('1.5 KB');
  });

  it('falls back to Bytes beyond the size table', () => {
    expect(formatBytes(1024 ** 5)).toBe('1 Bytes');
    expect(formatBytes(1024 ** 5, { sizeType: 'accurate' })).toBe('1 Bytes');
  });
});
