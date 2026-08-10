import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import { DatePicker } from '@/components/ui/date-picker';
import { employeeBpjsEnrollmentsQueryOptions } from '@/features/payroll/api/queries';
import {
  useCreateEmployeeBpjsFamilyMember,
  useDeleteEmployeeBpjsFamilyMember,
  useUpsertEmployeeBpjsEnrollment
} from '@/features/payroll/api/mutations';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import type { JkkRiskCategory } from '@/features/payroll/api/types';
import { formatPayrollMoney, validDates } from './-components';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export type BpjsFamilyMember = {
  id: number;
  enrollment_id: number;
  name: string;
  relationship: string;
  birth_date: string | null;
  is_core: boolean;
};

export type BpjsEnrollment = {
  id: number;
  employee_id: string;
  program: string;
  membership_number: string;
  registration_date: string | null;
  registered_wage: string;
  jkk_category_override: string | null;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  familyMembers: BpjsFamilyMember[];
};

export type BpjsDraft = {
  id?: number;
  program: 'jkk' | 'jkm' | 'jht' | 'jp' | 'kesehatan';
  registeredWage: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  jkkCategoryOverride: string;
};

type FamilyForm = { name: string; relationship: string; isCore: boolean };

const BPJS_PROGRAM_OPTIONS = ['jkk', 'jkm', 'jht', 'jp', 'kesehatan'] as const;
const JKK_CATEGORIES = ['very_low', 'low', 'medium', 'high', 'very_high'] as const;
const JKK_CATEGORY_KEYS: Record<string, string> = {
  very_low: 'payroll.veryLow',
  low: 'payroll.low',
  medium: 'payroll.medium',
  high: 'payroll.high',
  very_high: 'payroll.veryHigh'
};

export function BpjsEnrollmentCard({
  employeeId,
  onDirtyChange
}: {
  employeeId: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canEdit = canPayrollAction(permissions, isAdmin, 'edit');
  const bpjsQuery = useQuery({
    ...employeeBpjsEnrollmentsQueryOptions(employeeId),
    enabled: Boolean(employeeId)
  });
  const upsertBpjs = useUpsertEmployeeBpjsEnrollment();
  const createMember = useCreateEmployeeBpjsFamilyMember();
  const deleteMember = useDeleteEmployeeBpjsFamilyMember();
  const [bpjsDrafts, setBpjsDrafts] = useState<Record<number, BpjsDraft>>({});
  const [newBpjsDraft, setNewBpjsDraft] = useState<BpjsDraft | null>(null);
  const [familyForms, setFamilyForms] = useState<Record<number, FamilyForm>>({});
  const [removeTarget, setRemoveTarget] = useState<BpjsFamilyMember | null>(null);

  const bpjsEnrollments = bpjsQuery.data as { enrollments: BpjsEnrollment[] } | undefined;
  useEffect(() => {
    if (!bpjsEnrollments) return;
    setBpjsDrafts(
      Object.fromEntries(
        bpjsEnrollments.enrollments.map((enrollment) => [
          enrollment.id,
          {
            id: enrollment.id,
            program: enrollment.program as BpjsDraft['program'],
            registeredWage: enrollment.registered_wage,
            isActive: enrollment.is_active,
            effectiveFrom: enrollment.effective_from,
            effectiveTo: enrollment.effective_to ?? '',
            jkkCategoryOverride: enrollment.jkk_category_override ?? ''
          }
        ])
      )
    );
  }, [bpjsEnrollments]);

  const bpjsDirty = useMemo(() => {
    if (!bpjsEnrollments) return false;
    const baseline = new Map(
      bpjsEnrollments.enrollments.map((enrollment) => [enrollment.id, enrollment])
    );
    const draftIds = Object.keys(bpjsDrafts).map(Number);
    if (draftIds.length !== baseline.size) return true;
    for (const id of draftIds) {
      const draft = bpjsDrafts[id];
      const enrollment = baseline.get(id);
      if (!enrollment) return true;
      if (
        draft.program !== enrollment.program ||
        draft.registeredWage !== enrollment.registered_wage ||
        draft.isActive !== enrollment.is_active ||
        draft.effectiveFrom !== enrollment.effective_from ||
        draft.effectiveTo !== (enrollment.effective_to ?? '') ||
        draft.jkkCategoryOverride !== (enrollment.jkk_category_override ?? '')
      )
        return true;
    }
    return (
      Boolean(newBpjsDraft) ||
      Object.values(familyForms).some(
        (form) => form.name.trim() !== '' || form.relationship.trim() !== ''
      )
    );
  }, [bpjsEnrollments, bpjsDrafts, newBpjsDraft, familyForms]);

  useEffect(() => {
    onDirtyChange?.(bpjsDirty);
  }, [bpjsDirty, onDirtyChange]);

  const saveBpjs = (draft: BpjsDraft) => {
    if (!draft.registeredWage || !validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.invalidProfile'));
    void upsertBpjs
      .mutateAsync({
        employeeId,
        program: draft.program,
        registeredWage: draft.registeredWage,
        isActive: draft.isActive,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined,
        jkkCategoryOverride:
          draft.program === 'jkk'
            ? ((draft.jkkCategoryOverride || undefined) as JkkRiskCategory | undefined)
            : undefined
      })
      .then(() => {
        setNewBpjsDraft(null);
        toast.success(t('payroll.saved'));
      })
      .catch(() => toast.error(t('payroll.failed')));
  };
  const addMember = async (enrollmentId: number) => {
    const form = familyForms[enrollmentId];
    if (!form || !form.name.trim() || !form.relationship.trim())
      return toast.error(t('payroll.requiredFields'));
    try {
      await createMember.mutateAsync({
        enrollmentId,
        name: form.name,
        relationship: form.relationship,
        isCore: form.isCore
      });
      setFamilyForms((prev) => ({
        ...prev,
        [enrollmentId]: { name: '', relationship: '', isCore: true }
      }));
      toast.success(t('payroll.saved'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };
  const handleRemoveMember = async (member: BpjsFamilyMember) => {
    try {
      await deleteMember.mutateAsync({ id: member.id });
      toast.success(t('payroll.saved'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };

  const revertBpjs = (id: number) => {
    const enrollment = bpjsEnrollments?.enrollments.find((item) => item.id === id);
    if (!enrollment) return;
    setBpjsDrafts((prev) => ({
      ...prev,
      [id]: {
        id: enrollment.id,
        program: enrollment.program as BpjsDraft['program'],
        registeredWage: enrollment.registered_wage,
        isActive: enrollment.is_active,
        effectiveFrom: enrollment.effective_from,
        effectiveTo: enrollment.effective_to ?? '',
        jkkCategoryOverride: enrollment.jkk_category_override ?? ''
      }
    }));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.bpjsEnrollment')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {bpjsQuery.isLoading ? (
            <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
          ) : bpjsQuery.isError ? (
            <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
          ) : (bpjsEnrollments?.enrollments.length ?? 0) === 0 || newBpjsDraft ? (
            newBpjsDraft ? (
              <>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <div>
                    <Label htmlFor='new-bpjs-program'>{t('payroll.program')}</Label>
                    <NativeSelect
                      id='new-bpjs-program'
                      className='mt-1'
                      disabled={!canEdit}
                      value={newBpjsDraft.program}
                      onChange={(e) =>
                        setNewBpjsDraft({
                          ...newBpjsDraft,
                          program: e.target.value as BpjsDraft['program']
                        })
                      }
                    >
                      <option value=''>{t('payroll.select')}</option>
                      {BPJS_PROGRAM_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t(`payroll.${option === 'kesehatan' ? 'bpjsKesehatan' : option}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor='new-bpjs-wage'>{t('payroll.registeredWage')}</Label>
                    <Input
                      id='new-bpjs-wage'
                      className='mt-1'
                      disabled={!canEdit}
                      placeholder={t('payroll.registeredWage')}
                      value={newBpjsDraft.registeredWage}
                      onChange={(e) =>
                        setNewBpjsDraft({ ...newBpjsDraft, registeredWage: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor='new-bpjs-effective-from'>{t('payroll.effectiveFrom')}</Label>
                    <DatePicker
                      id='new-bpjs-effective-from'
                      className='mt-1'
                      disabled={!canEdit}
                      value={newBpjsDraft.effectiveFrom}
                      onChange={(date) =>
                        setNewBpjsDraft({ ...newBpjsDraft, effectiveFrom: date ?? '' })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor='new-bpjs-status'>{t('common.status')}</Label>
                    <NativeSelect
                      id='new-bpjs-status'
                      className='mt-1'
                      disabled={!canEdit}
                      value={newBpjsDraft.isActive ? 'active' : 'inactive'}
                      onChange={(e) =>
                        setNewBpjsDraft({
                          ...newBpjsDraft,
                          isActive: e.target.value === 'active'
                        })
                      }
                    >
                      <option value='active'>{t('common.active')}</option>
                      <option value='inactive'>{t('common.inactive')}</option>
                    </NativeSelect>
                  </div>
                  <div className='flex items-end gap-2 sm:col-span-2'>
                    <Button
                      disabled={!canEdit || upsertBpjs.isPending}
                      onClick={() => saveBpjs(newBpjsDraft)}
                    >
                      {t('common.save')}
                    </Button>
                    <Button
                      variant='ghost'
                      disabled={!canEdit}
                      onClick={() => setNewBpjsDraft(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
                {newBpjsDraft.program === 'jkk' ? (
                  <div className='flex items-center gap-2'>
                    <Label htmlFor='new-bpjs-jkk'>{t('payroll.riskCategory')}</Label>
                    <NativeSelect
                      id='new-bpjs-jkk'
                      disabled={!canEdit}
                      className='px-2'
                      value={newBpjsDraft.jkkCategoryOverride}
                      onChange={(e) =>
                        setNewBpjsDraft({ ...newBpjsDraft, jkkCategoryOverride: e.target.value })
                      }
                    >
                      <option value=''>{t('payroll.select')}</option>
                      {JKK_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {t(JKK_CATEGORY_KEYS[category])}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}
              </>
            ) : (
              <Button
                disabled={!canEdit}
                onClick={() =>
                  setNewBpjsDraft({
                    program: 'jkk',
                    registeredWage: '',
                    isActive: true,
                    effectiveFrom: '',
                    effectiveTo: '',
                    jkkCategoryOverride: ''
                  })
                }
              >
                {t('payroll.addBpjsEnrollment')}
              </Button>
            )
          ) : (
            <>
              <Button
                disabled={!canEdit}
                onClick={() =>
                  setNewBpjsDraft({
                    program: 'jkk',
                    registeredWage: '',
                    isActive: true,
                    effectiveFrom: '',
                    effectiveTo: '',
                    jkkCategoryOverride: ''
                  })
                }
              >
                {t('payroll.addBpjsEnrollment')}
              </Button>
              {bpjsEnrollments?.enrollments.map((enrollment) => {
                const draft = bpjsDrafts[enrollment.id];
                if (!draft) return null;
                const form = familyForms[enrollment.id] ?? {
                  name: '',
                  relationship: '',
                  isCore: true
                };
                return (
                  <div className='space-y-2 rounded-lg border p-3' key={enrollment.id}>
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>
                        {t(
                          `payroll.${enrollment.program === 'kesehatan' ? 'bpjsKesehatan' : enrollment.program}`
                        )}
                      </span>
                      <Badge variant={enrollment.is_active ? 'default' : 'secondary'}>
                        {enrollment.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </div>
                    <div className='grid gap-1 text-sm text-muted-foreground sm:grid-cols-2'>
                      <span>
                        {`${t('payroll.membershipNumber')}: `}
                        <span className='text-foreground'>
                          {enrollment.membership_number || '—'}
                        </span>
                      </span>
                      <span>
                        {`${t('payroll.registrationDate')}: `}
                        <span className='text-foreground'>
                          {enrollment.registration_date || '—'}
                        </span>
                      </span>
                      <span>
                        {`${t('payroll.registeredWage')}: `}
                        <span className='text-foreground'>
                          {formatPayrollMoney(enrollment.registered_wage)}
                        </span>
                      </span>
                      <span>
                        {`${t('payroll.jkkOverride')}: `}
                        <span className='text-foreground'>
                          {enrollment.jkk_category_override || '—'}
                        </span>
                      </span>
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <div>
                        <Label htmlFor={`bpjs-program-${enrollment.id}`}>
                          {t('payroll.program')}
                        </Label>
                        <NativeSelect
                          id={`bpjs-program-${enrollment.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.program}
                          onChange={(e) =>
                            setBpjsDrafts({
                              ...bpjsDrafts,
                              [enrollment.id]: {
                                ...draft,
                                program: e.target.value as BpjsDraft['program']
                              }
                            })
                          }
                        >
                          {BPJS_PROGRAM_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {t(`payroll.${option === 'kesehatan' ? 'bpjsKesehatan' : option}`)}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div>
                        <Label htmlFor={`bpjs-wage-${enrollment.id}`}>
                          {t('payroll.registeredWage')}
                        </Label>
                        <Input
                          id={`bpjs-wage-${enrollment.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.registeredWage}
                          onChange={(e) =>
                            setBpjsDrafts({
                              ...bpjsDrafts,
                              [enrollment.id]: { ...draft, registeredWage: e.target.value }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`bpjs-status-${enrollment.id}`}>{t('common.status')}</Label>
                        <NativeSelect
                          id={`bpjs-status-${enrollment.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.isActive ? 'active' : 'inactive'}
                          onChange={(e) =>
                            setBpjsDrafts({
                              ...bpjsDrafts,
                              [enrollment.id]: {
                                ...draft,
                                isActive: e.target.value === 'active'
                              }
                            })
                          }
                        >
                          <option value='active'>{t('common.active')}</option>
                          <option value='inactive'>{t('common.inactive')}</option>
                        </NativeSelect>
                      </div>
                      <div>
                        <Label htmlFor={`bpjs-effective-from-${enrollment.id}`}>
                          {t('payroll.effectiveFrom')}
                        </Label>
                        <DatePicker
                          id={`bpjs-effective-from-${enrollment.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.effectiveFrom}
                          onChange={(date) =>
                            setBpjsDrafts({
                              ...bpjsDrafts,
                              [enrollment.id]: { ...draft, effectiveFrom: date ?? '' }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`bpjs-effective-to-${enrollment.id}`}>
                          {t('payroll.effectiveTo')}
                        </Label>
                        <DatePicker
                          id={`bpjs-effective-to-${enrollment.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.effectiveTo}
                          onChange={(date) =>
                            setBpjsDrafts({
                              ...bpjsDrafts,
                              [enrollment.id]: { ...draft, effectiveTo: date ?? '' }
                            })
                          }
                        />
                      </div>
                      <div className='flex items-end gap-2'>
                        <Button
                          disabled={!canEdit || upsertBpjs.isPending}
                          size='sm'
                          onClick={() => saveBpjs(draft)}
                        >
                          {t('common.save')}
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          disabled={!canEdit}
                          onClick={() => revertBpjs(enrollment.id)}
                        >
                          {t('payroll.revert')}
                        </Button>
                      </div>
                    </div>
                    {draft.program === 'jkk' ? (
                      <div className='flex items-center gap-2'>
                        <Label htmlFor={`bpjs-jkk-${enrollment.id}`}>
                          {t('payroll.riskCategory')}
                        </Label>
                        <NativeSelect
                          id={`bpjs-jkk-${enrollment.id}`}
                          disabled={!canEdit}
                          className='px-2'
                          value={draft.jkkCategoryOverride}
                          onChange={(e) =>
                            setBpjsDrafts({
                              ...bpjsDrafts,
                              [enrollment.id]: {
                                ...draft,
                                jkkCategoryOverride: e.target.value
                              }
                            })
                          }
                        >
                          <option value=''>{t('payroll.select')}</option>
                          {JKK_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {t(JKK_CATEGORY_KEYS[category])}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    ) : null}
                    <div className='space-y-2'>
                      <p className='text-sm font-medium'>{t('payroll.familyMembers')}</p>
                      {enrollment.familyMembers.length > 0 ? (
                        <ul className='space-y-1'>
                          {enrollment.familyMembers.map((member) => (
                            <li
                              key={member.id}
                              className='flex items-center justify-between gap-2 text-sm'
                            >
                              <span>
                                {member.name} {t('payroll.separator')} {member.relationship}
                                {member.is_core ? (
                                  <Badge variant='outline' className='ml-2'>
                                    {t('payroll.isCore')}
                                  </Badge>
                                ) : null}
                              </span>
                              <Button
                                variant='ghost'
                                size='sm'
                                disabled={!canEdit}
                                onClick={() => setRemoveTarget(member)}
                              >
                                {t('common.delete')}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className='text-xs text-muted-foreground'>
                          {t('payroll.noFamilyMembers')}
                        </p>
                      )}
                      <div className='flex flex-wrap items-center gap-2'>
                        <Input
                          className='w-40'
                          aria-label={t('payroll.name')}
                          disabled={!canEdit}
                          placeholder={t('payroll.name')}
                          value={form.name}
                          onChange={(e) =>
                            setFamilyForms({
                              ...familyForms,
                              [enrollment.id]: { ...form, name: e.target.value }
                            })
                          }
                        />
                        <Input
                          className='w-40'
                          aria-label={t('payroll.relationship')}
                          disabled={!canEdit}
                          placeholder={t('payroll.relationship')}
                          value={form.relationship}
                          onChange={(e) =>
                            setFamilyForms({
                              ...familyForms,
                              [enrollment.id]: { ...form, relationship: e.target.value }
                            })
                          }
                        />
                        <label className='flex items-center gap-2 text-sm'>
                          <input
                            type='checkbox'
                            checked={form.isCore}
                            onChange={(e) =>
                              setFamilyForms({
                                ...familyForms,
                                [enrollment.id]: { ...form, isCore: e.target.checked }
                              })
                            }
                          />
                          {t('payroll.isCore')}
                        </label>
                        <Button
                          size='sm'
                          disabled={!canEdit || createMember.isPending}
                          onClick={() => addMember(enrollment.id)}
                        >
                          {t('common.add')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={t('confirm.deleteTitle')}
        description={t('confirm.deleteDescription')}
        confirmLabel={t('confirm.deleteConfirm')}
        destructive
        onConfirm={() => {
          if (removeTarget) void handleRemoveMember(removeTarget);
          setRemoveTarget(null);
        }}
      />
    </>
  );
}
