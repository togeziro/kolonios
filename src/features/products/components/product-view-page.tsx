import { useSuspenseQuery } from '@tanstack/react-query';
import type { Product } from '../api/types';
import { notFound } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import ProductForm from './product-form';
import { productByIdQueryOptions } from '../api/queries';

type TProductViewPageProps = {
  productId: string;
};

export default function ProductViewPage({ productId }: TProductViewPageProps) {
  const { t } = useTranslation();

  if (productId === 'new') {
    return <ProductForm initialData={null} pageTitle={t('product.createNew')} />;
  }

  return <EditProductView productId={Number(productId)} />;
}

function EditProductView({ productId }: { productId: number }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(productByIdQueryOptions(productId));

  if (!data?.success || !data?.product) {
    notFound();
  }

  return <ProductForm initialData={data.product as Product} pageTitle={t('product.edit')} />;
}
