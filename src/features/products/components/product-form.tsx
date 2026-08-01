import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createProductMutation, updateProductMutation } from '../api/mutations';
import type { Product } from '../api/types';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { productSchema, type ProductFormValues } from '@/features/products/schemas/product';
import { categoryOptions } from '@/features/products/constants/product-options';

export default function ProductForm({
  initialData,
  pageTitle
}: {
  initialData: Product | null;
  pageTitle: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const isEdit = !!initialData;

  const createMutation = useMutation(
    mergeMutationCallbacks(createProductMutation, {
      onSuccess: () => {
        toast.success(t('product.created'));
        router.navigate({ to: '/dashboard/product' });
      },
      onError: () => {
        toast.error(t('product.createFailed'));
      }
    })
  );

  const updateMutation = useMutation(
    mergeMutationCallbacks(updateProductMutation, {
      onSuccess: () => {
        toast.success(t('product.updated'));
        router.navigate({ to: '/dashboard/product' });
      },
      onError: () => {
        toast.error(t('product.updateFailed'));
      }
    })
  );

  const form = useAppForm({
    defaultValues: {
      image: undefined,
      name: initialData?.name ?? '',
      category: initialData?.category ?? '',
      price: initialData?.price,
      description: initialData?.description ?? ''
    } as ProductFormValues,
    validators: {
      onSubmit: productSchema
    },
    onSubmit: ({ value }) => {
      const payload = {
        name: value.name,
        category: value.category,
        price: value.price!,
        description: value.description
      };

      if (isEdit) {
        updateMutation.mutate({ id: initialData.id, values: payload });
      } else {
        createMutation.mutate(payload);
      }
    }
  });

  const { FormTextField, FormSelectField, FormTextareaField } = useFormFields<ProductFormValues>();

  return (
    <Card className='mx-auto w-full'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-8'>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <FormTextField
                name='name'
                label={t('product.name')}
                required
                placeholder={t('product.enterName')}
                validators={{
                  onBlur: z.string().min(2, t('product.nameRequired'))
                }}
              />

              <FormSelectField
                name='category'
                label={t('product.category')}
                required
                options={categoryOptions}
                placeholder={t('product.selectCategory')}
                validators={{
                  onBlur: z.string().min(1, t('product.categoryRequired'))
                }}
              />

              <FormTextField
                name='price'
                label={t('product.price')}
                required
                type='number'
                min={0}
                step={0.01}
                placeholder={t('product.enterPrice')}
                validators={{
                  onBlur: z.number({ message: t('product.priceRequired') })
                }}
              />
            </div>

            <FormTextareaField
              name='description'
              label={t('product.description')}
              required
              placeholder={t('product.enterDescription')}
              maxLength={500}
              rows={4}
              validators={{
                onBlur: z.string().min(10, t('product.descriptionRequired'))
              }}
            />

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => router.history.back()}>
                {t('common.back')}
              </Button>
              <form.SubmitButton>
                {isEdit ? t('product.updateProduct') : t('product.addProduct')}
              </form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}
