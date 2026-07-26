import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { designationsQueryOptions, departmentsQueryOptions } from '../api/queries';
import { createDesignationFn, updateDesignationFn, deleteDesignationFn } from '../api/service';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DesignationForm>(emptyForm);
  const [isEdit, setIsEdit] = useState(false);

  const { data: deptData } = useQuery(departmentsQueryOptions());
  const { data, isLoading } = useQuery(designationsQueryOptions());

  const departments = deptData?.departments ?? [];

  const displayData = (data?.designations ?? []).map(
    (r: {
      designation: {
        id: number;
        name: string;
        code: string;
        department_id: number | null;
        description: string | null;
        base_salary: number | null;
        is_active: boolean | null;
      };
      department: { name: string } | null;
    }) => ({
      ...r.designation,
      department_name: r.department?.name ?? '-'
    })
  );

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
        toast.success('Designation created');
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'designations'] });
        closeDialog();
      } else {
        toast.error(res?.message ?? 'Failed to create');
      }
    },
    onError: () => toast.error('Failed to create designation')
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
        toast.success('Designation updated');
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'designations'] });
        closeDialog();
      } else {
        toast.error(res?.message ?? 'Failed to update');
      }
    },
    onError: () => toast.error('Failed to update designation')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDesignationFn({ data: { id } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success('Designation deleted');
        queryClient.invalidateQueries({ queryKey: ['masterdata', 'designations'] });
      } else {
        toast.error(res?.message ?? 'Failed to delete');
      }
    },
    onError: () => toast.error('Failed to delete designation')
  });

  function openEdit(item: (typeof displayData)[number]) {
    setForm({
      id: item.id,
      name: item.name,
      code: item.code,
      department_id: item.department_id,
      description: item.description ?? '',
      base_salary: item.base_salary ? String(item.base_salary) : ''
    });
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
            <Icons.employee className='h-5 w-5' />
            Job Titles / Designations
          </CardTitle>
          <Button onClick={openCreate}>
            <Icons.add className='mr-2 h-4 w-4' /> Add Job Title
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Icons.spinner className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : displayData.length === 0 ? (
            <div className='py-8 text-center text-sm text-muted-foreground'>
              No job titles found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='w-24'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map(
                  (item: {
                    id: number;
                    name: string;
                    code: string;
                    department_id: number | null;
                    description: string | null;
                    base_salary: number | null;
                    is_active: boolean | null;
                    department_name: string;
                  }) => (
                    <TableRow key={item.id}>
                      <TableCell className='font-mono text-xs'>{item.code}</TableCell>
                      <TableCell className='font-medium'>{item.name}</TableCell>
                      <TableCell>{item.department_name}</TableCell>
                      <TableCell>
                        {item.base_salary
                          ? `Rp ${Number(item.base_salary).toLocaleString('id')}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.is_active ? 'default' : 'secondary'}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex gap-1'>
                          <Button variant='ghost' size='icon' onClick={() => openEdit(item)}>
                            <Icons.edit className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => {
                              if (confirm('Delete this designation?')) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                          >
                            <Icons.trash className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Job Title' : 'New Job Title'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update job title details' : 'Add a new job title'}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Code *</Label>
              <Input
                placeholder='e.g. FLD_TECH'
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className='space-y-2'>
              <Label>Name *</Label>
              <Input
                placeholder='e.g. Field Technician'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label>Department</Label>
              <Select
                value={form.department_id ? String(form.department_id) : ''}
                onValueChange={(v) =>
                  setForm({ ...form, department_id: v === 'none' ? null : Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select department' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Base Salary (Rp)</Label>
              <Input
                type='number'
                placeholder='Optional base salary'
                value={form.base_salary}
                onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label>Description</Label>
              <Input
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
