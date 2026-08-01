import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { deleteProductMutation } from '../../api/mutations';
import type { Product } from '../../api/types';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { Icons } from '@/components/icons';
import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface CellActionProps {
  data: Product;
}

export function CellAction({ data }: CellActionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const deleteMutation = useMutation(
    mergeMutationCallbacks(deleteProductMutation, {
      onSuccess: () => {
        toast.success(t('product.deleted'));
        setOpen(false);
      },
      onError: () => {
        toast.error(t('product.deleteFailed'));
      }
    })
  );

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={() => deleteMutation.mutate(data.id)}
        loading={deleteMutation.isPending}
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>{t('common.openMenu')}</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>{t('table.actions')}</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => router.navigate({ to: `/dashboard/product/${data.id}` })}
          >
            <Icons.edit className='mr-2 h-4 w-4' /> {t('common.update')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Icons.trash className='mr-2 h-4 w-4' /> {t('common.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
