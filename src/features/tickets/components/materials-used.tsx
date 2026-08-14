import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Icons } from '@/components/icons';
import type { WorkSessionMaterialInput } from '../api/types';

export function clampQty(qty: number): number {
  return Math.min(999, Math.max(1, Math.round(qty)));
}

export function adjustQty(
  materials: WorkSessionMaterialInput[],
  index: number,
  delta: number
): WorkSessionMaterialInput[] {
  return materials.map((m, i) => (i === index ? { ...m, qty: clampQty(m.qty + delta) } : m));
}

function emptyRow(): WorkSessionMaterialInput {
  return { name: '', qty: 1, unit: '', source: 'van' };
}

export default function MaterialsUsed({
  materials,
  onChange,
  disabled
}: {
  materials: WorkSessionMaterialInput[];
  onChange: (next: WorkSessionMaterialInput[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<WorkSessionMaterialInput>(emptyRow());

  const add = () => {
    const name = draft.name.trim();
    if (!name) return;
    onChange([...materials, { ...draft, name }]);
    setDraft(emptyRow());
  };

  return (
    <div className='space-y-3'>
      <p className='text-[10px] font-bold tracking-widest uppercase text-muted-foreground'>
        {t('workSession.materialsUsed')}
      </p>
      <ul className='space-y-2'>
        {materials.map((m, i) => (
          <li
            key={`${m.name}-${i}`}
            className='flex items-center justify-between rounded-xl border bg-card px-3 py-2 dark:border-zinc-800/50 dark:bg-zinc-900'
          >
            <div className='min-w-0'>
              <p className='truncate text-sm font-semibold'>{m.name}</p>
              <p className='text-xs text-muted-foreground'>
                {m.source === 'van' ? t('workSession.van') : t('workSession.warehouse')}
                {m.unit ? ` · ${m.unit}` : ''}
              </p>
            </div>
            <div className='flex items-center gap-1'>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='size-7'
                disabled={disabled || m.qty <= 1}
                onClick={() => onChange(adjustQty(materials, i, -1))}
              >
                {'−'}
              </Button>
              <span className='w-8 text-center text-sm font-bold'>{m.qty}</span>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='size-7'
                disabled={disabled || m.qty >= 999}
                onClick={() => onChange(adjustQty(materials, i, 1))}
              >
                +
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7 text-destructive'
                disabled={disabled}
                onClick={() => onChange(materials.filter((_, idx) => idx !== i))}
              >
                <Icons.trash className='size-4' />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className='space-y-2 rounded-xl border p-3 dark:border-zinc-800/50'>
        <div className='grid grid-cols-2 gap-2'>
          <Input
            value={draft.name}
            placeholder={t('workSession.materialName')}
            disabled={disabled}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <Input
            value={draft.unit}
            placeholder={t('workSession.unit')}
            disabled={disabled}
            onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
          />
        </div>
        <div className='flex items-center gap-2'>
          <NativeSelect
            value={draft.source}
            disabled={disabled}
            onChange={(e) =>
              setDraft((d) => ({ ...d, source: e.target.value as 'van' | 'warehouse' }))
            }
          >
            <option value='van'>{t('workSession.van')}</option>
            <option value='warehouse'>{t('workSession.warehouse')}</option>
          </NativeSelect>
          <Button
            type='button'
            variant='outline'
            className='shrink-0'
            disabled={disabled || !draft.name.trim()}
            onClick={add}
          >
            <Icons.add className='mr-1 size-4' />
            {t('workSession.addMaterial')}
          </Button>
        </div>
      </div>
    </div>
  );
}
