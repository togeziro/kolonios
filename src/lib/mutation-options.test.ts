import { describe, expect, it, vi } from 'vitest';
import type { MutationOptions } from '@tanstack/react-query';
import { mergeMutationCallbacks } from './mutation-options';

type TestOptions = MutationOptions<unknown, Error, unknown, unknown>;

const ARGS = [undefined, undefined, undefined, undefined] as unknown as Parameters<
  NonNullable<TestOptions['onSuccess']>
>;

describe('mergeMutationCallbacks', () => {
  it('runs the base onSuccess before the extra onSuccess', () => {
    const baseOnSuccess = vi.fn();
    const extraOnSuccess = vi.fn();

    const options = mergeMutationCallbacks({ onSuccess: baseOnSuccess } as TestOptions, {
      onSuccess: extraOnSuccess
    });

    options.onSuccess?.(...ARGS);

    expect(baseOnSuccess).toHaveBeenCalledWith(...ARGS);
    expect(extraOnSuccess).toHaveBeenCalledWith(...ARGS);
    expect(baseOnSuccess.mock.invocationCallOrder[0]).toBeLessThan(
      extraOnSuccess.mock.invocationCallOrder[0]
    );
  });

  it('runs the base onError before the extra onError', () => {
    const baseOnError = vi.fn();
    const extraOnError = vi.fn();

    const options = mergeMutationCallbacks({ onError: baseOnError } as TestOptions, {
      onError: extraOnError
    });

    const errorArgs = [new Error('boom'), undefined, undefined, undefined] as unknown as Parameters<
      NonNullable<TestOptions['onError']>
    >;

    options.onError?.(...errorArgs);

    expect(baseOnError).toHaveBeenCalledWith(...errorArgs);
    expect(extraOnError).toHaveBeenCalledWith(...errorArgs);
  });

  it('works with only extra callbacks (no base callbacks)', () => {
    const extraOnSuccess = vi.fn();

    const options = mergeMutationCallbacks({} as TestOptions, {
      onSuccess: extraOnSuccess
    });

    options.onSuccess?.(...ARGS);
    expect(extraOnSuccess).toHaveBeenCalledWith(...ARGS);
  });

  it('preserves mutationFn and other options', () => {
    const mutationFn = vi.fn();

    const options = mergeMutationCallbacks({ mutationFn, retry: 2 } as TestOptions, {
      onSuccess: vi.fn()
    });

    expect(options.retry).toBe(2);
    options.mutationFn?.('payload', undefined as never);
    expect(mutationFn).toHaveBeenCalledWith('payload', undefined);
  });
});
