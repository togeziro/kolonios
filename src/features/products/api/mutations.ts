import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createProductFn, updateProductFn, deleteProductFn } from './service';
import { productKeys } from './queries';
import type { ProductMutationPayload } from './types';

export const createProductMutation = mutationOptions({
  mutationFn: (data: ProductMutationPayload) => createProductFn({ data }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  }
});

export const updateProductMutation = mutationOptions({
  mutationFn: ({ id, values }: { id: number; values: ProductMutationPayload }) =>
    updateProductFn({ data: { id, values } }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  }
});

export const deleteProductMutation = mutationOptions({
  mutationFn: (id: number) => deleteProductFn({ data: id }),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  }
});
