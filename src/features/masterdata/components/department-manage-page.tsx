import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { departmentsQueryOptions } from '../api/queries';
import { createDepartmentFn, updateDepartmentFn, deleteDepartmentFn } from '../api/service';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface DepartmentForm {
  id?: number;
  name: string;
  code: string;
  description: string;
}

const emptyForm: DepartmentForm = { name: '', code: '', description: '' };

export default function DepartmentManagePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [isEdit, setIsEdit] = useState(false);

  const { data, isLoading } = useQuery(departmentsQueryOptions());
  const departments = data?.departments ?? [];

  const createMutation = useMutation({
    mutationFn: (d: DepartmentForm) =>
      createDepartmentFn({
        data: { name: d.name, code: d.code, description: d.description || undefined }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('masterdata.departmentCreated'));
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'departments'] });
        closeDialog();
      } else {
        toast.error(res?.message ?? t('masterdata.departmentCreateFailed'));
      }
    },
    onError: () => toast.error(t('masterdata.departmentCreateFailed'))
  });

  const updateMutation = useMutation({
    mutationFn: (d: DepartmentForm) =>
      updateDepartmentFn({
        data: {
          id: d.id!,
          name: d.name,
          code: d.code,
          description: d.description || undefined
        }
      }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('masterdata.departmentUpdated'));
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'departments'] });
        closeDialog();
      } else {
        toast.error(res?.message ?? t('masterdata.departmentUpdateFailed'));
      }
    },
    onError: () => toast.error(t('masterdata.departmentUpdateFailed'))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDepartmentFn({ data: { id } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('masterdata.departmentDeleted'));
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'departments'] });
      } else {
        toast.error(res?.message ?? t('masterdata.departmentDeleteFailed'));
      }
    },
    onError: () => toast.error(t('masterdata.departmentDeleteFailed'))
  });

  function openEdit(dept: (typeof departments)[number]) {
    setForm({ id: dept.id, name: dept.name, code: dept.code, description: dept.description ?? '' });
    setIsEdit(true);
    setDialogOpen(true);
  }

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
            <Icons.workspace className='h-5 w-5' />
            {t('masterdata.departmentsTitle')}
          </CardTitle>
          <Button onClick={openCreate}>
            <Icons.add className='mr-2 h-4 w-4' /> {t('masterdata.addDepartment')}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : departments.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              {t('masterdata.noDepartments')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.code')}</TableHead>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('masterdata.description')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className='w-24'>{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className='font-mono text-xs'>{dept.code}</TableCell>
                    <TableCell className='font-medium'>{dept.name}</TableCell>
                    <TableCell className='text-muted-foreground'>
                      {dept.description ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dept.is_active ? 'default' : 'secondary'}>
                        {dept.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-1'>
                        <Button variant='ghost' size='icon' onClick={() => openEdit(dept)}>
                          <Icons.edit className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            if (confirm(t('masterdata.deleteDepartmentConfirm'))) {
                              deleteMutation.mutate(dept.id);
                            }
                          }}
                        >
                          <Icons.trash className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? t('masterdata.editDepartment') : t('masterdata.newDepartment')}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? t('masterdata.departmentEditDescription')
                : t('masterdata.departmentAddDescription')}
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
              <Label>{t('masterdata.description')}</Label>
              <Textarea
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
