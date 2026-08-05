import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type SortingState,
  type ColumnPinningState,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { designationsQueryOptions, departmentsQueryOptions } from '../api/queries';
import { createDesignationFn, updateDesignationFn, deleteDesignationFn } from '../api/service';
import { DataTable } from '@/components/ui/table/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getDesignationColumns, type DesignationRow } from './designation-columns';

interface DesignationForm {
  id?: number;
  name: string;
  code: string;
  department_id: number | null;
  description: string;
  base_salary: string;
}

const emptyForm: DesignationForm = {
  name: '',
  code: '',
  department_id: null,
  description: '',
  base_salary: ''
};

export default function DesignationManagePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DesignationForm>(emptyForm);
  const [isEdit, setIsEdit] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: deptData } = useQuery(departmentsQueryOptions());
  const { data, isLoading } = useQuery(designationsQueryOptions());

  const departments = deptData?.departments ?? [];

  const displayData = useMemo(() => {
    return (data?.designations ?? []).map(
      (r: {
        designation: {
          id: number;
          name: string;
          code: string;
          department_id: number | null;
          description: string | null;
          base_salary: number | null;
          is_active: boolean | null;
          created_at: Date;
        };
        department: { name: string } | null;
      }) => ({
        ...r.designation,
        department_name: r.department?.name ?? '-'
      })
    );
  }, [data]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDesignationFn({ data: { id } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('masterdata.designationDeleted'));
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'designations'] });
      } else {
        toast.error(res?.message ?? t('masterdata.designationDeleteFailed'));
      }
    },
    onError: () => toast.error(t('masterdata.designationDeleteFailed'))
  });

  const handleEdit = useCallback((row: DesignationRow) => {
    setForm({
      id: row.id,
      name: row.name,
      code: row.code,
      department_id: row.department_id,
      description: row.description ?? '',
      base_salary: row.base_salary ? String(row.base_salary) : ''
    });
    setIsEdit(true);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (row: DesignationRow) => {
      if (confirm(t('masterdata.deleteDesignationConfirm'))) {
        deleteMutation.mutate(row.id);
      }
    },
    [deleteMutation, t]
  );

  const columns = useMemo(
    () => getDesignationColumns(handleEdit, handleDelete, t),
    [handleEdit, handleDelete, t]
  );

  const table = useReactTable({
    data: displayData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
      columnPinning: { right: ['actions'] } as ColumnPinningState
    }
  });

  const createMutation = useMutation({
    mutationFn: (d: DesignationForm) =>
      createDesignationFn({
        data: {
          name: d.name,
          code: d.code,
          department_id: d.department_id ?? undefined,
          description: d.description || undefined,
          base_salary: d.base_salary ? Number(d.base_salary) : undefined
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('masterdata.designationCreated'));
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'designations'] });
        closeDialog();
      } else {
        toast.error(res?.message ?? t('masterdata.designationCreateFailed'));
      }
    },
    onError: () => toast.error(t('masterdata.designationCreateFailed'))
  });

  const updateMutation = useMutation({
    mutationFn: (d: DesignationForm) =>
      updateDesignationFn({
        data: {
          id: d.id!,
          name: d.name,
          code: d.code,
          department_id: d.department_id,
          description: d.description || undefined,
          base_salary: d.base_salary ? Number(d.base_salary) : undefined
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('masterdata.designationUpdated'));
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'designations'] });
        closeDialog();
      } else {
        toast.error(res?.message ?? t('masterdata.designationUpdateFailed'));
      }
    },
    onError: () => toast.error(t('masterdata.designationUpdateFailed'))
  });

  function openCreate() {
    setForm(emptyForm);
    setIsEdit(false);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setForm(emptyForm);
    setIsEdit(false);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Icons.employee className='h-5 w-5' />
            {t('masterdata.jobTitlesTitle')}
          </CardTitle>
          <Button onClick={openCreate}>
            <Icons.add className='mr-2 h-4 w-4' /> {t('masterdata.addJobTitle')}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : displayData.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              {t('masterdata.noJobTitles')}
            </div>
          ) : (
            <DataTable table={table} />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? t('masterdata.editJobTitle') : t('masterdata.newJobTitle')}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? t('masterdata.jobTitleEditDescription')
                : t('masterdata.jobTitleAddDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>{t('masterdata.codeRequired')}</Label>
              <Input
                placeholder={t('masterdata.codePlaceholder')}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className='space-y-2'>
              <Label>{t('masterdata.nameRequired')}</Label>
              <Input
                placeholder={t('masterdata.namePlaceholder')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label>{t('masterdata.department')}</Label>
              <Select
                value={form.department_id ? String(form.department_id) : ''}
                onValueChange={(v) =>
                  setForm({ ...form, department_id: v === 'none' ? null : Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('employee.selectDepartment')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>{t('masterdata.noDepartment')}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>{t('masterdata.baseSalaryRp')}</Label>
              <Input
                type='number'
                placeholder={t('masterdata.baseSalaryPlaceholder')}
                value={form.base_salary}
                onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label>{t('masterdata.description')}</Label>
              <Input
                placeholder={t('masterdata.descriptionPlaceholder')}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={closeDialog}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!form.name || !form.code) {
                  toast.error(t('masterdata.nameAndCodeRequired'));
                  return;
                }
                if (isEdit) {
                  updateMutation.mutate(form);
                } else {
                  createMutation.mutate(form);
                }
              }}
              disabled={isPending || !form.name || !form.code}
            >
              {isPending ? (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <Icons.check className='mr-2 h-4 w-4' />
              )}
              {isEdit ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
