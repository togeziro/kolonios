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

interface DepartmentForm {
  id?: number;
  name: string;
  code: string;
  description: string;
}

const emptyForm: DepartmentForm = { name: '', code: '', description: '' };

export default function DepartmentManagePage() {
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
        toast.success('Department created');
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'departments'] });
        closeDialog();
      } else {
        toast.error(res?.message ?? 'Failed to create');
      }
    },
    onError: () => toast.error('Failed to create department')
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
        toast.success('Department updated');
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'departments'] });
        closeDialog();
      } else {
        toast.error(res?.message ?? 'Failed to update');
      }
    },
    onError: () => toast.error('Failed to update department')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDepartmentFn({ data: { id } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success('Department deleted');
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'departments'] });
      } else {
        toast.error(res?.message ?? 'Failed to delete');
      }
    },
    onError: () => toast.error('Failed to delete department')
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
            Departments
          </CardTitle>
          <Button onClick={openCreate}>
            <Icons.add className='mr-2 h-4 w-4' /> Add Department
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : departments.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              No departments found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='w-24'>Actions</TableHead>
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
                        {dept.is_active ? 'Active' : 'Inactive'}
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
                            if (confirm('Delete this department?')) {
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
            <DialogTitle>{isEdit ? 'Edit Department' : 'New Department'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update department details' : 'Add a new department'}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Code *</Label>
              <Input
                placeholder='e.g. ENG'
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className='space-y-2'>
              <Label>Name *</Label>
              <Input
                placeholder='e.g. Engineering'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label>Description</Label>
              <Textarea
                placeholder='Optional description'
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!form.name || !form.code) {
                  toast.error('Name and code are required');
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
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
