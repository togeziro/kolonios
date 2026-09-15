import { beforeEach, describe, expect, it, vi } from 'vitest';

// Never load the real Human.js (WebGL + model fetch) in tests.
const harness = vi.hoisted(() => {
  interface MockInstance {
    load: ReturnType<typeof vi.fn>;
    models: { reset: ReturnType<typeof vi.fn> };
  }
  const instances: MockInstance[] = [];
  let loadBehavior: () => Promise<void> = async () => {};
  class MockHuman {
    load = vi.fn(async () => {
      await loadBehavior();
    });
    models = { reset: vi.fn() };
    constructor() {
      instances.push(this);
    }
  }
  return {
    instances,
    MockHuman,
    setLoadBehavior(fn: () => Promise<void>) {
      loadBehavior = fn;
    }
  };
});

vi.mock('@vladmandic/human', () => ({ default: harness.MockHuman }));

beforeEach(async () => {
  vi.resetModules();
  harness.instances.length = 0;
  harness.setLoadBehavior(async () => {});
});

describe('getHuman singleton', () => {
  it('loads once and returns the cached instance to concurrent callers', async () => {
    const mod = await import('./human');
    const [a, b] = await Promise.all([mod.getHuman(), mod.getHuman()]);
    expect(a).toBe(b);
    expect(harness.instances).toHaveLength(1);
    expect(harness.instances[0].load).toHaveBeenCalledTimes(1);
    expect(mod.isHumanLoaded()).toBe(true);
  });

  it('retries with a fresh instance after a failed load', async () => {
    let calls = 0;
    harness.setLoadBehavior(async () => {
      calls += 1;
      if (calls === 1) throw new Error('model fetch failed');
    });
    const mod = await import('./human');
    await expect(mod.getHuman()).rejects.toThrow('model fetch failed');
    expect(mod.isHumanLoaded()).toBe(false);
    const human = await mod.getHuman();
    expect(harness.instances).toHaveLength(2);
    expect(mod.isHumanLoaded()).toBe(true);
    expect(human).toBe(harness.instances[1]);
  });
});

describe('disposeHuman', () => {
  it('unloads models via models.reset and forces a fresh load next time', async () => {
    const mod = await import('./human');
    const first = await mod.getHuman();
    mod.disposeHuman();
    expect(harness.instances[0].models.reset).toHaveBeenCalledTimes(1);
    expect(mod.isHumanLoaded()).toBe(false);
    const second = await mod.getHuman();
    expect(harness.instances).toHaveLength(2);
    expect(second).not.toBe(first);
    expect(second).toBe(harness.instances[1]);
  });

  it('is a safe no-op when nothing is loaded', async () => {
    const mod = await import('./human');
    expect(() => mod.disposeHuman()).not.toThrow();
    expect(mod.isHumanLoaded()).toBe(false);
  });

  it('discards an in-flight load instead of resurrecting the singleton', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.setLoadBehavior(() => gate);
    const mod = await import('./human');
    const pending = mod.getHuman();
    mod.disposeHuman();
    release();
    await expect(pending).rejects.toThrow('disposed during load');
    expect(harness.instances).toHaveLength(1);
    expect(harness.instances[0].models.reset).toHaveBeenCalledTimes(1);
    expect(mod.isHumanLoaded()).toBe(false);
    // Next call starts a clean load, not a poisoned one.
    harness.setLoadBehavior(async () => {});
    const fresh = await mod.getHuman();
    expect(harness.instances).toHaveLength(2);
    expect(fresh).toBe(harness.instances[1]);
  });
});
