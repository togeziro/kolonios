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
import { locationsQueryOptions } from '@/features/attendance/api/queries';
import { useCreateTicket } from '../api/hooks';
import CustomerPicker from './customer-picker';
import type { TicketTaskType, TicketChannel, TicketPriority } from '../api/types';
import type { NewTicketInput, NewLegInput } from '../api/types';

export type CreateTicketFormValues = {
  title: string;
  description: string;
  taskType: TicketTaskType | undefined;
  channel: TicketChannel | undefined;
  customerId: string | undefined;
  assetName: string;
  locationId: number | undefined;
  priority: TicketPriority | undefined;
  dueDate: string | undefined;
  estimatedMinutes: number | undefined;
  legs: NewLegInput[];
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
    priority: values.priority,
    dueAt: values.dueDate,
    estimatedMinutes: values.estimatedMinutes,
    legs: legs.length > 0 ? legs : undefined
  };
}

const MAX_LEGS = 8;
const TASK_TYPES: TicketTaskType[] = [
  'installation',
  'maintenance',
  'inspection',
  'data',
  'sales',
  'others'
];
const CHANNELS: TicketChannel[] = ['whatsapp', 'phone', 'email', 'walk_in', 'field', 'others'];

export default function CreateTicketForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createTicket = useCreateTicket();

  const locations = useQuery(locationsQueryOptions());

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      taskType: undefined as TicketTaskType | undefined,
      channel: undefined as TicketChannel | undefined,
      customerId: undefined as string | undefined,
      assetName: '',
      locationId: undefined as number | undefined,
      priority: 'medium' as TicketPriority,
      dueDate: undefined as string | undefined,
      estimatedMinutes: undefined as number | undefined,
      legs: [{ name: 'Survey', description: '' }] as NewLegInput[]
    },
    onSubmit: async ({ value }) => {
      const input = toCreateTicketInput(
        value,
        value.legs.filter((l) => l.name.trim().length > 0)
      );
      const res = await createTicket.mutateAsync(input);
      if (res?.success) {
        navigate({ to: '/dashboard/jobs' });
      }
    }
  });

  function patchLeg(index: number, patch: Partial<NewLegInput>) {
    const legsField = form.state.values.legs;
    const next = legsField.map((l, i) => (i === index ? { ...l, ...patch } : l));
    form.setFieldValue('legs', next);
  }

  return (
    <div className='mx-auto max-w-xl space-y-4 p-4'>
      <button
        type='button'
        onClick={() => navigate({ to: '/dashboard/jobs' })}
        className='flex items-center gap-1 text-xs font-semibold text-muted-foreground'
      >
        <Icons.chevronLeft className='h-3.5 w-3.5' /> {t('ticket.back')}
      </button>
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
                        {type === 'others' ? t('ticket.taskTypeOthers') : type}
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
                        {c === 'others' ? t('ticket.channelOthers') : c}
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
                <CustomerPicker value={field.state.value} onChange={(v) => field.handleChange(v)} />
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

          <form.Field name='priority'>
            {(field) => (
              <div className='space-y-1.5'>
                <Label>{t('ticket.priority')}</Label>
                <div className='flex gap-2'>
                  {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
                    <button
                      key={p}
                      type='button'
                      onClick={() => field.handleChange(p)}
                      className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
                        field.state.value === p
                          ? p === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : p === 'medium'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-zinc-700 text-zinc-300'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {t(`ticket.${p}`)}
                    </button>
                  ))}
                </div>
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
          <form.Field name='legs' mode='array'>
            {(legsField) => {
              const legs = legsField.state.value;
              return (
                <>
                  <div className='mb-3 flex items-center justify-between'>
                    <h2 className='dark:text-white text-sm font-semibold'>{t('ticket.legs')}</h2>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => legsField.pushValue({ name: '', description: '' })}
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
                          onClick={() => legsField.removeValue(index)}
                          disabled={legs.length === 1}
                        >
                          <Icons.trash className='h-4 w-4' />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              );
            }}
          </form.Field>
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
