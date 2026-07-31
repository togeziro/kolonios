import { describe, expect, it, vi } from 'vitest';
import { composeRefs } from './compose-refs';

describe('composeRefs', () => {
  it('calls callback refs with the node', () => {
    const cb = vi.fn();
    const ref = composeRefs(cb);
    const node = { tag: 'div' };
    ref(node);
    expect(cb).toHaveBeenCalledWith(node);
  });

  it('assigns object refs', () => {
    const obj: { current: { tag: string } | null } = { current: null };
    const ref = composeRefs(obj);
    const node = { tag: 'span' };
    ref(node);
    expect(obj.current).toBe(node);
  });

  it('ignores null and undefined refs', () => {
    const obj: { current: { tag: string } | null } = { current: null };
    const ref = composeRefs(null, undefined, obj);
    const node = { tag: 'p' };
    expect(() => ref(node)).not.toThrow();
    expect(obj.current).toBe(node);
  });

  it('returns a cleanup that resets refs when none return a cleanup', () => {
    const obj: { current: { tag: string } | null } = { current: null };
    const ref = composeRefs(obj);
    const node = { tag: 'a' };
    const cleanup = ref(node);
    expect(cleanup).toBeUndefined();
  });

  it('returns a cleanup that runs cleanups and resets object refs', () => {
    const cleanupFn = vi.fn();
    const cb = vi.fn(() => cleanupFn);
    const obj: { current: { tag: string } | null } = { current: null };
    const ref = composeRefs(cb, obj);
    const node = { tag: 'b' };
    const cleanup = ref(node);
    expect(cleanup).toBeTypeOf('function');
    cleanup!();
    expect(cleanupFn).toHaveBeenCalled();
    expect(obj.current).toBeNull();
  });

  it('sets object refs and calls callback refs in order', () => {
    const obj: { current: { tag: string } | null } = { current: null };
    const cb = vi.fn();
    const ref = composeRefs(obj, cb);
    const node = { tag: 'c' };
    const cleanup = ref(node);
    expect(cleanup).toBeUndefined();
    expect(obj.current).toBe(node);
    expect(cb).toHaveBeenCalledWith(node);
  });
});
