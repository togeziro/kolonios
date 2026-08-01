import type { MutationOptions } from '@tanstack/react-query';

interface ExtraCallbacks<TData, TError, TVariables, TContext> {
  onSuccess?: MutationOptions<TData, TError, TVariables, TContext>['onSuccess'];
  onError?: MutationOptions<TData, TError, TVariables, TContext>['onError'];
}

export function mergeMutationCallbacks<TData, TError, TVariables, TContext>(
  options: MutationOptions<TData, TError, TVariables, TContext>,
  extra: ExtraCallbacks<TData, TError, TVariables, TContext>
): MutationOptions<TData, TError, TVariables, TContext> {
  const baseOnSuccess = options.onSuccess;
  const baseOnError = options.onError;
  const extraOnSuccess = extra.onSuccess;
  const extraOnError = extra.onError;

  return {
    ...options,
    onSuccess:
      baseOnSuccess || extraOnSuccess
        ? (data, variables, onMutateResult, context) => {
            baseOnSuccess?.(data, variables, onMutateResult, context);
            extraOnSuccess?.(data, variables, onMutateResult, context);
          }
        : undefined,
    onError:
      baseOnError || extraOnError
        ? (error, variables, onMutateResult, context) => {
            baseOnError?.(error, variables, onMutateResult, context);
            extraOnError?.(error, variables, onMutateResult, context);
          }
        : undefined
  };
}
