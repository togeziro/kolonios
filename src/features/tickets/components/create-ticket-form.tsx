import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { DatePicker } from '@/components/ui/date-picker';
import { Icons } from '@/components/icons';
import { customersQueryOptions } from '@/features/customers/api/queries';
import { locationsQueryOptions } from '@/features/attendance/api/queries';
import { useCreateTicket } from '../api/hooks';
import type { TicketTaskType, TicketChannel } from '../api/types';
import type { NewTicketInput, NewLegInput } from '../api/types';

export type CreateTicketFormValues = {
  title: string;
  description: string;
  taskType: TicketTaskType | undefined;
  channel: TicketChannel | undefined;
  customerId: string | undefined;
  assetName: string;
  locationId: number | undefined;
  dueDate: string | undefined;
  estimatedMinutes: number | undefined;
};

export function toCreateTicketInput(
  values: CreateTicketFormValues,
  legs: NewLegInput[]
): NewTicketInput {
  return {
    title: values.title,
    description: values.description || undefined,
    taskType: values.taskType,
    channel: values.channel,
    customerId: values.customerId,
    assetName: values.assetName || undefined,
    locationId: values.locationId,
    dueAt: values.dueDate,
    estimatedMinutes: values.estimatedMinutes,
    legs: legs.length > 0 ? legs : undefined
  };
}

const MAX_LEGS = 8;
const TASK_TYPES: TicketTaskType[] = ['installation', 'maintenance', 'inspection', 'data', 'sales'];
const CHANNELS: TicketChannel[] = ['whatsapp', 'phone', 'email', 'walk_in', 'field'];

export default function CreateTicketForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createTicket = useCreateTicket();
  const [legs, setLegs] = useState<NewLegInput[]>([{ name: 'Survey', description: '' }]);

  const customers = useQuery(customersQueryOptions({ page: 1, limit: 50, sort: 'name' }));
  const locations = useQuery(locationsQueryOptions());

  const customerOptions = useMemo(() => customers.data?.customers ?? [], [customers.data]);

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      taskType: undefined as TicketTaskType | undefined,
      channel: undefined as TicketChannel | undefined,
      customerId: undefined as string | undefined,
      assetName: '',
      locationId: undefined as number | undefined,
      dueDate: undefined as string | undefined,
      estimatedMinutes: undefined as number | undefined
    },
    onSubmit: async ({ value }) => {
      const input = toCreateTicketInput(
        value,
        legs.filter((l) => l.name.trim().length > 0)
      );
      const res = await createTicket.mutateAsync(input);
      if (res?.success) {
        navigate({ to: '/dashboard/jobs' });
      }
    }
  });

  function patchLeg(index: number, patch: Partial<NewLegInput>) {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  return (
    <div className='mx-auto max-w-xl space-y-4 p-4'>
      <h1 className='text-lg font-bold'>{t('ticket.createTitle')}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className='space-y-4'
      >
        <Card className='dark:border-zinc-800/50 space-y-4 rounded-2xl p-4 dark:bg-zinc-900'>
          <form.Field name='title'>
            {(field) => (
              <div className='space-y-1.5'>
                <Label htmlFor='ticket-title'>{t('ticket.formTitle')}</Label>
                <Input
                  id='ticket-title'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('ticket.formTitle')}
                />
              </div>
            )}
          </form.Field>

          <div className='grid grid-cols-2 gap-3'>
            <form.Field name='taskType'>
              {(field) => (
                <div className='space-y-1.5'>
                  <Label>{t('ticket.formTaskType')}</Label>
                  <NativeSelect
                    value={field.state.value ?? ''}
                    onChange={(e) =>
                      field.handleChange(
                        (e.target.value || undefined) as TicketTaskType | undefined
                      )
                    }
                  >
                    <option value=''>--</option>
                    {TASK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </form.Field>
            <form.Field name='channel'>
              {(field) => (
                <div className='space-y-1.5'>
                  <Label>{t('ticket.formChannel')}</Label>
                  <NativeSelect
                    value={field.state.value ?? ''}
                    onChange={(e) =>
                      field.handleChange((e.target.value || undefined) as TicketChannel | undefined)
                    }
                  >
                    <option value=''>--</option>
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name='customerId'>
            {(field) => (
              <div className='space-y-1.5'>
                <Label>{t('ticket.formCustomer')}</Label>
                <NativeSelect
                  value={field.state.value ?? ''}
                  onChange={(e) =>
                    field.handleChange((e.target.value || undefined) as string | undefined)
                  }
                >
                  <option value=''>--</option>
                  {customerOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </form.Field>

          <form.Field name='assetName'>
            {(field) => (
              <div className='space-y-1.5'>
                <Label>{t('ticket.formAssetName')}</Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name='locationId'>
            {(field) => (
              <div className='space-y-1.5'>
                <Label>{t('ticket.formLocation')}</Label>
                <NativeSelect
                  value={field.state.value ? String(field.state.value) : ''}
                  onChange={(e) =>
                    field.handleChange(e.target.value ? Number(e.target.value) : undefined)
                  }
                >
                  <option value=''>--</option>
                  {(locations.data?.locations ?? []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </form.Field>

          <div className='grid grid-cols-2 gap-3'>
            <form.Field name='dueDate'>
              {(field) => (
                <div className='space-y-1.5'>
                  <Label>{t('ticket.formDueDate')}</Label>
                  <DatePicker
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    placeholder={t('ticket.formDueDate')}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name='estimatedMinutes'>
              {(field) => (
                <div className='space-y-1.5'>
                  <Label>{t('ticket.formEstimatedMinutes')}</Label>
                  <Input
                    type='number'
                    min={1}
                    value={field.state.value ?? ''}
                    onChange={(e) =>
                      field.handleChange(e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name='description'>
            {(field) => (
              <div className='space-y-1.5'>
                <Label>{t('ticket.formDescription')}</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </Card>

        <Card className='dark:border-zinc-800/50 rounded-2xl p-4 dark:bg-zinc-900'>
          <div className='mb-3 flex items-center justify-between'>
            <h2 className='dark:text-white text-sm font-semibold'>{t('ticket.legs')}</h2>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                setLegs((prev) =>
                  prev.length >= MAX_LEGS ? prev : [...prev, { name: '', description: '' }]
                )
              }
              disabled={legs.length >= MAX_LEGS}
            >
              <Icons.plusCircle className='mr-1 h-3.5 w-3.5' /> {t('ticket.addLeg')}
            </Button>
          </div>
          <div className='space-y-3'>
            {legs.map((leg, index) => (
              <div key={index} className='flex items-start gap-2'>
                <div className='flex-1 space-y-2'>
                  <Input
                    value={leg.name}
                    placeholder={`${t('ticket.leg')} ${index + 1}`}
                    onChange={(e) => patchLeg(index, { name: e.target.value })}
                  />
                  <Input
                    value={leg.description ?? ''}
                    placeholder={t('ticket.formDescription')}
                    onChange={(e) => patchLeg(index, { description: e.target.value })}
                  />
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={t('ticket.removeLeg')}
                  onClick={() => setLegs((prev) => prev.filter((_, i) => i !== index))}
                  disabled={legs.length === 1}
                >
                  <Icons.trash className='h-4 w-4' />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Button type='submit' className='w-full' disabled={createTicket.isPending}>
          {createTicket.isPending ? (
            <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Icons.plusCircle className='mr-2 h-4 w-4' />
          )}
          {t('ticket.submit')}
        </Button>
      </form>
    </div>
  );
}
