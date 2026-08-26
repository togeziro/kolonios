import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { salaryComponentsQueryOptions } from '@/features/payroll/api/queries';
import {
  useCreateSalaryComponent,
  useDeleteSalaryComponent,
  useUpdateSalaryComponent
} from '@/features/payroll/api/mutations';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { formatCurrency } from '@/lib/format';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import type { SalaryComponentDefinition } from '@/features/payroll/api/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function validDates(from: string, to: string) {
  return Boolean(from) && (!to || from <= to);
}

export function maskBankAccount(value: string) {
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

export function formatPayrollMoney(value: string | number | null | undefined) {
  return formatCurrency(value ?? 0);
}

/**
 * Ready-to-Pay queue summary (Kerjoo §6.2): "Total payroll: Rp X dari N
 * karyawan" plus a live chip for the current checkbox selection.
 */
export function PayQueueSummaryBar({
  t,
  totalNet,
  employeeCount,
  selectedCount,
  selectedNet
}: {
  t: TFunction;
  totalNet: string;
  employeeCount: number;
  selectedCount: number;
  selectedNet: string;
}) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-3'>
      <div className='flex flex-wrap items-baseline gap-2 text-sm'>
        <span className='text-muted-foreground'>{t('payroll.payQueue.totalPayroll')}</span>
        <span className='text-base font-semibold'>{formatPayrollMoney(totalNet)}</span>
        <span className='inline-flex items-baseline gap-1 text-muted-foreground'>
          {t('payroll.payQueue.from')}
          <span>{employeeCount}</span>
          {t('payroll.payQueue.employees')}
        </span>
      </div>
      {selectedCount > 0 && (
        <Badge data-testid='pay-queue-selection-chip' variant='secondary'>
          {t('payroll.payQueue.selectedChip', {
            count: selectedCount,
            amount: formatPayrollMoney(selectedNet)
          })}
        </Badge>
      )}
    </div>
  );
}
export function SalaryComponentsPanel() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canAdd = canPayrollAction(permissions, isAdmin, 'add');
  const canEdit = canPayrollAction(permissions, isAdmin, 'edit');
  const canDelete = canPayrollAction(permissions, isAdmin, 'delete');
  const { data, isLoading, isError } = useQuery(salaryComponentsQueryOptions());
  const create = useCreateSalaryComponent();
  const update = useUpdateSalaryComponent();
  const remove = useDeleteSalaryComponent();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryComponentDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalaryComponentDefinition | null>(null);
  const [form, setForm] = useState<{
    code: string;
    name: string;
    type: 'allowance' | 'deduction';
    description: string;
    isActive: boolean;
  }>({ code: '', name: '', type: 'allowance', description: '', isActive: true });

  const startEdit = (item?: SalaryComponentDefinition) => {
    setEditing(item ?? null);
    setForm({
      code: item?.code ?? '',
      name: item?.name ?? '',
      type: item?.type ?? 'allowance',
      description: item?.description ?? '',
      isActive: item?.is_active ?? true
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return toast.error(t('payroll.requiredFields'));
    try {
      if (editing) await update.mutateAsync({ id: editing.id, values: form });
      else await create.mutateAsync(form);
      toast.success(t('payroll.saved'));
      setOpen(false);
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  const handleDelete = async (id: number) => {
    try {
      await remove.mutateAsync({ id });
      toast.success(t('payroll.deleted'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between gap-2'>
          <CardTitle>{t('payroll.components')}</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size='sm' disabled={!canAdd} onClick={() => startEdit()}>
                {t('payroll.addComponent')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? t('payroll.editComponent') : t('payroll.addComponent')}
                </DialogTitle>
              </DialogHeader>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1'>
                  <Label>{t('payroll.code')}</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>{t('payroll.name')}</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>{t('payroll.type')}</Label>
                  <NativeSelect
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as 'allowance' | 'deduction' })
                    }
                  >
                    <option value='allowance'>{t('payroll.allowance')}</option>
                    <option value='deduction'>{t('payroll.deduction')}</option>
                  </NativeSelect>
                </div>
                <div className='space-y-1 sm:col-span-2'>
                  <Label>{t('payroll.description')}</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <Button
                onClick={save}
                disabled={
                  (!editing && !canAdd) ||
                  (editing && !canEdit) ||
                  create.isPending ||
                  update.isPending
                }
              >
                {t('common.save')}
              </Button>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading && <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>}
          {isError && <p className='text-sm text-destructive'>{t('payroll.failed')}</p>}
          {!isLoading && !isError && !(data ?? []).length && (
            <p className='text-sm text-muted-foreground'>{t('payroll.noComponents')}</p>
          )}
          {!isLoading && !isError && (data ?? []).length > 0 && (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('payroll.code')}</TableHead>
                    <TableHead>{t('payroll.name')}</TableHead>
                    <TableHead>{t('payroll.type')}</TableHead>
                    <TableHead>{t('payroll.status')}</TableHead>
                    <TableHead className='text-right'>{t('payroll.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data as SalaryComponentDefinition[] | undefined) ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.code}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        {item.type === 'allowance'
                          ? t('payroll.allowance')
                          : t('payroll.deduction')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.is_active ? 'default' : 'secondary'}>
                          {item.is_active ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          disabled={!canEdit}
                          onClick={() => startEdit(item)}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          disabled={!canDelete}
                          onClick={() => setDeleteTarget(item)}
                        >
                          {t('common.delete')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('confirm.deleteTitle')}
        description={t('confirm.deleteDescription')}
        confirmLabel={t('confirm.deleteConfirm')}
        destructive
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
