import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { maskBankAccount } from './-components';
import type { UseProfileDraftsResult } from './-profile-drafts';
import {
  type Assignment,
  type BenefitDraft,
  type ComponentDraft,
  type ProfileData
} from './-profile-types';
import type { TaxDraft } from './-profile-tax-history';
import { BpjsEnrollmentCard } from './-profile-bpjs';
import { TaxHistoryCard, TaxProfileSelects } from './-profile-tax-history';
import { PaymentHistoryCard } from './-profile-payment-history';

export type TabContext = {
  t: (key: string, params?: Record<string, unknown>) => string;
  canEdit: boolean;
  isPending: boolean;
  data: ProfileData;
  employeeId: string;
  selectedAssignmentId: number | undefined;
  salaryLabel: (salaryType: string) => string;
  componentDefinitions: { data: { id: number; name: string }[] | undefined };
} & UseProfileDraftsResult;

export function SalaryAssignmentTab(ctx: TabContext) {
  const {
    t,
    canEdit,
    isPending,
    employeeId,
    dirty,
    assignment,
    setAssignment,
    requestSalarySave,
    resetDrafts
  } = ctx;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payroll.salaryAssignment')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {assignment ? (
          <>
            <div>
              <Label htmlFor='assignment-salary-type'>{t('payroll.salaryType')}</Label>
              <NativeSelect
                id='assignment-salary-type'
                className='mt-1'
                disabled={!canEdit}
                value={assignment.salary_type}
                onChange={(e) =>
                  setAssignment({
                    ...assignment,
                    salary_type: e.target.value as Assignment['salary_type']
                  })
                }
              >
                <option value='monthly'>{t('payroll.monthly')}</option>
                <option value='daily'>{t('payroll.daily')}</option>
                <option value='hourly'>{t('payroll.hourly')}</option>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor='assignment-amount'>{t('payroll.amount')}</Label>
              <Input
                id='assignment-amount'
                disabled={!canEdit}
                value={assignment.amount}
                onChange={(e) => setAssignment({ ...assignment, amount: e.target.value })}
              />
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div>
                <Label htmlFor='assignment-effective-from'>{t('payroll.effectiveFrom')}</Label>
                <DatePicker
                  id='assignment-effective-from'
                  disabled={!canEdit}
                  value={assignment.effective_from}
                  onChange={(date) => setAssignment({ ...assignment, effective_from: date ?? '' })}
                />
              </div>
              <div>
                <Label htmlFor='assignment-effective-to'>{t('payroll.effectiveTo')}</Label>
                <DatePicker
                  id='assignment-effective-to'
                  disabled={!canEdit}
                  value={assignment.effective_to ?? undefined}
                  onChange={(date) => setAssignment({ ...assignment, effective_to: date || null })}
                />
              </div>
            </div>
            <div className='flex gap-2'>
              <Button disabled={!canEdit || isPending} onClick={requestSalarySave}>
                {t('common.save')}
              </Button>
              {dirty && (
                <Button
                  variant='ghost'
                  disabled={!canEdit || isPending}
                  onClick={() => resetDrafts()}
                >
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          </>
        ) : (
          <Button
            disabled={!canEdit}
            onClick={() =>
              setAssignment({
                id: 0,
                employee_id: employeeId,
                salary_type: 'monthly',
                amount: '',
                effective_from: '',
                effective_to: null,
                department_id: null,
                designation_id: null
              })
            }
          >
            {t('payroll.addProfile')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ComponentsTab(ctx: TabContext) {
  const {
    t,
    canEdit,
    isPending,
    data,
    selectedAssignmentId,
    componentDrafts,
    setComponentDrafts,
    newComponentDraft,
    setNewComponentDraft,
    saveComponent,
    revertComponent
  } = ctx;
  const componentDefinitionsQuery = ctx.componentDefinitions;
  const newDraft: ComponentDraft = {
    assignmentId: selectedAssignmentId ?? 0,
    salaryComponentId: 0,
    amount: '',
    mode: 'fixed',
    percentageBase: 'base-salary',
    attendanceMetric: 'payable-days',
    taxable: false,
    effectiveFrom: '',
    effectiveTo: ''
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payroll.components')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {data.components.length === 0 || newComponentDraft ? (
          newComponentDraft ? (
            <>
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                <div>
                  <Label htmlFor='new-component-definition'>{t('payroll.component')}</Label>
                  <NativeSelect
                    id='new-component-definition'
                    disabled={!canEdit}
                    className='mt-1'
                    value={newComponentDraft.salaryComponentId || ''}
                    onChange={(e) =>
                      setNewComponentDraft({
                        ...newComponentDraft,
                        salaryComponentId: Number(e.target.value)
                      })
                    }
                  >
                    <option value=''>{t('payroll.selectComponent')}</option>
                    {(componentDefinitionsQuery.data ?? []).map((definition) => (
                      <option key={definition.id} value={definition.id}>
                        {definition.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor='new-component-amount'>{t('payroll.amount')}</Label>
                  <Input
                    id='new-component-amount'
                    className='mt-1'
                    disabled={!canEdit}
                    placeholder={t('payroll.amount')}
                    value={newComponentDraft.amount}
                    onChange={(e) =>
                      setNewComponentDraft({
                        ...newComponentDraft,
                        amount: e.target.value
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor='new-component-mode'>{t('payroll.mode')}</Label>
                  <NativeSelect
                    id='new-component-mode'
                    disabled={!canEdit}
                    className='mt-1'
                    value={newComponentDraft.mode}
                    onChange={(e) =>
                      setNewComponentDraft({
                        ...newComponentDraft,
                        mode: e.target.value as ComponentDraft['mode']
                      })
                    }
                  >
                    <option value='fixed'>{t('payroll.fixed')}</option>
                    <option value='percentage'>{t('payroll.percentage')}</option>
                    <option value='per-attendance'>{t('payroll.perAttendance')}</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor='new-component-taxable'>{t('payroll.taxable')}</Label>
                  <div className='mt-1 flex h-10 items-center'>
                    <input
                      id='new-component-taxable'
                      type='checkbox'
                      disabled={!canEdit}
                      checked={newComponentDraft.taxable}
                      onChange={(e) =>
                        setNewComponentDraft({
                          ...newComponentDraft,
                          taxable: e.target.checked
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor='new-component-effective-from'>{t('payroll.effectiveFrom')}</Label>
                  <DatePicker
                    id='new-component-effective-from'
                    className='mt-1'
                    disabled={!canEdit}
                    value={newComponentDraft.effectiveFrom}
                    onChange={(date) =>
                      setNewComponentDraft({
                        ...newComponentDraft,
                        effectiveFrom: date ?? ''
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor='new-component-effective-to'>{t('payroll.effectiveTo')}</Label>
                  <DatePicker
                    id='new-component-effective-to'
                    className='mt-1'
                    disabled={!canEdit}
                    value={newComponentDraft.effectiveTo}
                    onChange={(date) =>
                      setNewComponentDraft({
                        ...newComponentDraft,
                        effectiveTo: date ?? ''
                      })
                    }
                  />
                </div>
                <div className='flex items-end gap-2'>
                  <Button
                    disabled={!canEdit || isPending || !selectedAssignmentId}
                    onClick={() => saveComponent(newComponentDraft)}
                  >
                    {t('common.save')}
                  </Button>
                  <Button
                    variant='ghost'
                    disabled={!canEdit}
                    onClick={() => setNewComponentDraft(null)}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
              {newComponentDraft.mode === 'percentage' ? (
                <div>
                  <Label htmlFor='new-component-percentage-base'>
                    {t('payroll.percentageBase')}
                  </Label>
                  <NativeSelect
                    id='new-component-percentage-base'
                    disabled={!canEdit}
                    value={newComponentDraft.percentageBase}
                    onChange={(e) =>
                      setNewComponentDraft({
                        ...newComponentDraft,
                        percentageBase: e.target.value as ComponentDraft['percentageBase']
                      })
                    }
                  >
                    <option value='base-salary'>{t('payroll.baseSalary')}</option>
                    <option value='gross-salary'>{t('payroll.grossSalary')}</option>
                  </NativeSelect>
                </div>
              ) : null}
              {newComponentDraft.mode === 'per-attendance' ? (
                <div>
                  <Label htmlFor='new-component-attendance-metric'>
                    {t('payroll.attendanceMetric')}
                  </Label>
                  <NativeSelect
                    id='new-component-attendance-metric'
                    disabled={!canEdit}
                    value={newComponentDraft.attendanceMetric}
                    onChange={(e) =>
                      setNewComponentDraft({
                        ...newComponentDraft,
                        attendanceMetric: e.target.value as ComponentDraft['attendanceMetric']
                      })
                    }
                  >
                    <option value='payable-days'>{t('payroll.payableDays')}</option>
                    <option value='worked-hours'>{t('payroll.workedHours')}</option>
                    <option value='late-count'>{t('payroll.lateCount')}</option>
                  </NativeSelect>
                </div>
              ) : null}
            </>
          ) : (
            <Button
              disabled={!canEdit || !selectedAssignmentId}
              onClick={() => setNewComponentDraft(newDraft)}
            >
              {t('payroll.addComponent')}
            </Button>
          )
        ) : (
          <>
            <Button
              disabled={!canEdit || !selectedAssignmentId}
              onClick={() => setNewComponentDraft(newDraft)}
            >
              {t('payroll.addComponent')}
            </Button>
            {data.components.map(({ component, definition }) => {
              const draft = componentDrafts[component.id];
              if (!draft) return null;
              return (
                <div className='space-y-2 rounded-lg border p-3' key={component.id}>
                  <div className='flex items-center justify-between'>
                    <span className='font-medium'>{definition.name}</span>
                    <Badge variant='outline'>{t(`payroll.${definition.type}`)}</Badge>
                  </div>
                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                    <div>
                      <Label htmlFor={`component-amount-${component.id}`}>
                        {t('payroll.amount')}
                      </Label>
                      <Input
                        id={`component-amount-${component.id}`}
                        className='mt-1'
                        disabled={!canEdit}
                        value={draft.amount}
                        onChange={(e) =>
                          setComponentDrafts({
                            ...componentDrafts,
                            [component.id]: { ...draft, amount: e.target.value }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`component-mode-${component.id}`}>{t('payroll.mode')}</Label>
                      <NativeSelect
                        id={`component-mode-${component.id}`}
                        className='mt-1'
                        disabled={!canEdit}
                        value={draft.mode}
                        onChange={(e) =>
                          setComponentDrafts({
                            ...componentDrafts,
                            [component.id]: {
                              ...draft,
                              mode: e.target.value as ComponentDraft['mode']
                            }
                          })
                        }
                      >
                        <option value='fixed'>{t('payroll.fixed')}</option>
                        <option value='percentage'>{t('payroll.percentage')}</option>
                        <option value='per-attendance'>{t('payroll.perAttendance')}</option>
                      </NativeSelect>
                    </div>
                    <div>
                      <Label htmlFor={`component-taxable-${component.id}`}>
                        {t('payroll.taxable')}
                      </Label>
                      <div className='mt-1 flex h-10 items-center'>
                        <input
                          id={`component-taxable-${component.id}`}
                          type='checkbox'
                          disabled={!canEdit}
                          checked={draft.taxable}
                          onChange={(e) =>
                            setComponentDrafts({
                              ...componentDrafts,
                              [component.id]: {
                                ...draft,
                                taxable: e.target.checked
                              }
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`component-effective-from-${component.id}`}>
                        {t('payroll.effectiveFrom')}
                      </Label>
                      <DatePicker
                        id={`component-effective-from-${component.id}`}
                        className='mt-1'
                        disabled={!canEdit}
                        value={draft.effectiveFrom}
                        onChange={(date) =>
                          setComponentDrafts({
                            ...componentDrafts,
                            [component.id]: { ...draft, effectiveFrom: date ?? '' }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`component-effective-to-${component.id}`}>
                        {t('payroll.effectiveTo')}
                      </Label>
                      <DatePicker
                        id={`component-effective-to-${component.id}`}
                        className='mt-1'
                        disabled={!canEdit}
                        value={draft.effectiveTo}
                        onChange={(date) =>
                          setComponentDrafts({
                            ...componentDrafts,
                            [component.id]: { ...draft, effectiveTo: date ?? '' }
                          })
                        }
                      />
                    </div>
                  </div>
                  {draft.mode === 'percentage' ? (
                    <div>
                      <Label htmlFor={`component-percentage-base-${component.id}`}>
                        {t('payroll.percentageBase')}
                      </Label>
                      <NativeSelect
                        id={`component-percentage-base-${component.id}`}
                        disabled={!canEdit}
                        value={draft.percentageBase}
                        onChange={(e) =>
                          setComponentDrafts({
                            ...componentDrafts,
                            [component.id]: {
                              ...draft,
                              percentageBase: e.target.value as ComponentDraft['percentageBase']
                            }
                          })
                        }
                      >
                        <option value='base-salary'>{t('payroll.baseSalary')}</option>
                        <option value='gross-salary'>{t('payroll.grossSalary')}</option>
                      </NativeSelect>
                    </div>
                  ) : draft.mode === 'per-attendance' ? (
                    <div>
                      <Label htmlFor={`component-attendance-metric-${component.id}`}>
                        {t('payroll.attendanceMetric')}
                      </Label>
                      <NativeSelect
                        id={`component-attendance-metric-${component.id}`}
                        disabled={!canEdit}
                        value={draft.attendanceMetric}
                        onChange={(e) =>
                          setComponentDrafts({
                            ...componentDrafts,
                            [component.id]: {
                              ...draft,
                              attendanceMetric: e.target.value as ComponentDraft['attendanceMetric']
                            }
                          })
                        }
                      >
                        <option value='payable-days'>{t('payroll.payableDays')}</option>
                        <option value='worked-hours'>{t('payroll.workedHours')}</option>
                        <option value='late-count'>{t('payroll.lateCount')}</option>
                      </NativeSelect>
                    </div>
                  ) : null}
                  <div className='flex gap-2'>
                    <Button
                      disabled={!canEdit || isPending}
                      size='sm'
                      onClick={() => saveComponent(draft)}
                    >
                      {t('common.save')}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      disabled={!canEdit}
                      onClick={() => revertComponent(component.id)}
                    >
                      {t('payroll.revert')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function TaxTab(ctx: TabContext) {
  const {
    t,
    canEdit,
    isPending,
    data,
    taxDrafts,
    setTaxDrafts,
    newTaxDraft,
    setNewTaxDraft,
    saveTax,
    revertTax
  } = ctx;
  const emptyTax: TaxDraft = {
    taxIdentifier: '',
    filingStatus: '',
    employmentStatus: '',
    ptkpStatus: '',
    residency: '',
    taxFacility: '',
    taxObjectCode: '',
    pph21Method: '',
    effectiveFrom: '',
    effectiveTo: ''
  };
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.pph21')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {data.taxProfiles.length === 0 || newTaxDraft ? (
            newTaxDraft ? (
              <div className='grid gap-3 sm:grid-cols-2'>
                <div>
                  <Label htmlFor='new-tax-identifier'>{t('payroll.taxIdentifier')}</Label>
                  <Input
                    id='new-tax-identifier'
                    className='mt-1'
                    disabled={!canEdit}
                    placeholder={t('payroll.taxIdentifier')}
                    value={newTaxDraft.taxIdentifier}
                    onChange={(e) =>
                      setNewTaxDraft({ ...newTaxDraft, taxIdentifier: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor='new-tax-filing-status'>{t('payroll.filingStatus')}</Label>
                  <Input
                    id='new-tax-filing-status'
                    className='mt-1'
                    disabled={!canEdit}
                    placeholder={t('payroll.filingStatus')}
                    value={newTaxDraft.filingStatus}
                    onChange={(e) =>
                      setNewTaxDraft({ ...newTaxDraft, filingStatus: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor='new-tax-effective-from'>{t('payroll.effectiveFrom')}</Label>
                  <DatePicker
                    id='new-tax-effective-from'
                    className='mt-1'
                    disabled={!canEdit}
                    value={newTaxDraft.effectiveFrom}
                    onChange={(date) =>
                      setNewTaxDraft({ ...newTaxDraft, effectiveFrom: date ?? '' })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor='new-tax-effective-to'>{t('payroll.effectiveTo')}</Label>
                  <DatePicker
                    id='new-tax-effective-to'
                    className='mt-1'
                    disabled={!canEdit}
                    value={newTaxDraft.effectiveTo}
                    onChange={(date) => setNewTaxDraft({ ...newTaxDraft, effectiveTo: date ?? '' })}
                  />
                </div>
                <div className='grid gap-3 sm:col-span-2 sm:grid-cols-3'>
                  <TaxProfileSelects
                    value={newTaxDraft}
                    disabled={!canEdit}
                    onChange={(next) => setNewTaxDraft(next)}
                  />
                </div>
                <div className='flex gap-2 sm:col-span-2'>
                  <Button disabled={!canEdit || isPending} onClick={() => saveTax(newTaxDraft)}>
                    {t('common.save')}
                  </Button>
                  <Button variant='ghost' disabled={!canEdit} onClick={() => setNewTaxDraft(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button disabled={!canEdit} onClick={() => setNewTaxDraft(emptyTax)}>
                {t('payroll.addTaxRecord')}
              </Button>
            )
          ) : (
            <>
              <Button disabled={!canEdit} onClick={() => setNewTaxDraft(emptyTax)}>
                {t('payroll.addTaxRecord')}
              </Button>
              {data.taxProfiles.map((tax) => {
                const draft = taxDrafts[tax.id];
                if (!draft) return null;
                return (
                  <div className='space-y-3 rounded-lg border p-3' key={tax.id}>
                    <div className='grid gap-3 sm:grid-cols-2'>
                      <div>
                        <Label htmlFor={`tax-identifier-${tax.id}`}>
                          {t('payroll.taxIdentifier')}
                        </Label>
                        <Input
                          id={`tax-identifier-${tax.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          placeholder={t('payroll.taxIdentifier')}
                          value={draft.taxIdentifier}
                          onChange={(e) =>
                            setTaxDrafts({
                              ...taxDrafts,
                              [tax.id]: { ...draft, taxIdentifier: e.target.value }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`tax-filing-status-${tax.id}`}>
                          {t('payroll.filingStatus')}
                        </Label>
                        <Input
                          id={`tax-filing-status-${tax.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          placeholder={t('payroll.filingStatus')}
                          value={draft.filingStatus}
                          onChange={(e) =>
                            setTaxDrafts({
                              ...taxDrafts,
                              [tax.id]: { ...draft, filingStatus: e.target.value }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`tax-effective-from-${tax.id}`}>
                          {t('payroll.effectiveFrom')}
                        </Label>
                        <DatePicker
                          id={`tax-effective-from-${tax.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.effectiveFrom}
                          onChange={(date) =>
                            setTaxDrafts({
                              ...taxDrafts,
                              [tax.id]: { ...draft, effectiveFrom: date ?? '' }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`tax-effective-to-${tax.id}`}>
                          {t('payroll.effectiveTo')}
                        </Label>
                        <DatePicker
                          id={`tax-effective-to-${tax.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.effectiveTo}
                          onChange={(date) =>
                            setTaxDrafts({
                              ...taxDrafts,
                              [tax.id]: { ...draft, effectiveTo: date ?? '' }
                            })
                          }
                        />
                      </div>
                    </div>
                    <TaxProfileSelects
                      value={draft}
                      disabled={!canEdit}
                      onChange={(next) => setTaxDrafts({ ...taxDrafts, [tax.id]: next })}
                    />
                    <div className='flex gap-2'>
                      <Button disabled={!canEdit || isPending} onClick={() => saveTax(draft)}>
                        {t('common.save')}
                      </Button>
                      <Button variant='ghost' disabled={!canEdit} onClick={() => revertTax(tax.id)}>
                        {t('payroll.revert')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
      <TaxHistoryCard taxRecords={data.taxRecords} />
    </>
  );
}

export function BpjsTab(ctx: TabContext) {
  const {
    t,
    canEdit,
    isPending,
    data,
    employeeId,
    benefitDrafts,
    setBenefitDrafts,
    newBenefitDraft,
    setNewBenefitDraft,
    saveBenefit,
    revertBenefit,
    setBpjsDirty
  } = ctx;
  const emptyBenefit: BenefitDraft = {
    benefitCode: '',
    benefitName: '',
    amount: '',
    status: 'active',
    effectiveFrom: '',
    effectiveTo: ''
  };
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.bpjs')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {data.benefits.length === 0 || newBenefitDraft ? (
            newBenefitDraft ? (
              <div className='grid gap-3 sm:grid-cols-2'>
                <div>
                  <Label htmlFor='new-benefit-code'>{t('payroll.code')}</Label>
                  <Input
                    id='new-benefit-code'
                    className='mt-1'
                    disabled={!canEdit}
                    placeholder={t('payroll.code')}
                    value={newBenefitDraft.benefitCode}
                    onChange={(e) =>
                      setNewBenefitDraft({
                        ...newBenefitDraft,
                        benefitCode: e.target.value
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor='new-benefit-name'>{t('payroll.name')}</Label>
                  <Input
                    id='new-benefit-name'
                    className='mt-1'
                    disabled={!canEdit}
                    placeholder={t('payroll.name')}
                    value={newBenefitDraft.benefitName}
                    onChange={(e) =>
                      setNewBenefitDraft({
                        ...newBenefitDraft,
                        benefitName: e.target.value
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor='new-benefit-amount'>{t('payroll.amount')}</Label>
                  <Input
                    id='new-benefit-amount'
                    className='mt-1'
                    disabled={!canEdit}
                    placeholder={t('payroll.amount')}
                    value={newBenefitDraft.amount}
                    onChange={(e) =>
                      setNewBenefitDraft({ ...newBenefitDraft, amount: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor='new-benefit-effective-from'>{t('payroll.effectiveFrom')}</Label>
                  <DatePicker
                    id='new-benefit-effective-from'
                    className='mt-1'
                    disabled={!canEdit}
                    value={newBenefitDraft.effectiveFrom}
                    onChange={(date) =>
                      setNewBenefitDraft({
                        ...newBenefitDraft,
                        effectiveFrom: date ?? ''
                      })
                    }
                  />
                </div>
                <div className='flex items-end gap-2 sm:col-span-2'>
                  <Button
                    disabled={!canEdit || isPending}
                    onClick={() => saveBenefit(newBenefitDraft)}
                  >
                    {t('common.save')}
                  </Button>
                  <Button
                    variant='ghost'
                    disabled={!canEdit}
                    onClick={() => setNewBenefitDraft(null)}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button disabled={!canEdit} onClick={() => setNewBenefitDraft(emptyBenefit)}>
                {t('payroll.addBenefit')}
              </Button>
            )
          ) : (
            <>
              <Button disabled={!canEdit} onClick={() => setNewBenefitDraft(emptyBenefit)}>
                {t('payroll.addBenefit')}
              </Button>
              {data.benefits.map((benefit) => {
                const draft = benefitDrafts[benefit.id];
                if (!draft) return null;
                return (
                  <div className='space-y-3 rounded-lg border p-3' key={benefit.id}>
                    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                      <div>
                        <Label htmlFor={`benefit-code-${benefit.id}`}>{t('payroll.code')}</Label>
                        <Input
                          id={`benefit-code-${benefit.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.benefitCode}
                          onChange={(e) =>
                            setBenefitDrafts({
                              ...benefitDrafts,
                              [benefit.id]: { ...draft, benefitCode: e.target.value }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`benefit-name-${benefit.id}`}>{t('payroll.name')}</Label>
                        <Input
                          id={`benefit-name-${benefit.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.benefitName}
                          onChange={(e) =>
                            setBenefitDrafts({
                              ...benefitDrafts,
                              [benefit.id]: { ...draft, benefitName: e.target.value }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`benefit-amount-${benefit.id}`}>
                          {t('payroll.amount')}
                        </Label>
                        <Input
                          id={`benefit-amount-${benefit.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.amount}
                          onChange={(e) =>
                            setBenefitDrafts({
                              ...benefitDrafts,
                              [benefit.id]: { ...draft, amount: e.target.value }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`benefit-effective-from-${benefit.id}`}>
                          {t('payroll.effectiveFrom')}
                        </Label>
                        <DatePicker
                          id={`benefit-effective-from-${benefit.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.effectiveFrom}
                          onChange={(date) =>
                            setBenefitDrafts({
                              ...benefitDrafts,
                              [benefit.id]: { ...draft, effectiveFrom: date ?? '' }
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`benefit-effective-to-${benefit.id}`}>
                          {t('payroll.effectiveTo')}
                        </Label>
                        <DatePicker
                          id={`benefit-effective-to-${benefit.id}`}
                          className='mt-1'
                          disabled={!canEdit}
                          value={draft.effectiveTo}
                          onChange={(date) =>
                            setBenefitDrafts({
                              ...benefitDrafts,
                              [benefit.id]: { ...draft, effectiveTo: date ?? '' }
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className='flex gap-2'>
                      <Button disabled={!canEdit || isPending} onClick={() => saveBenefit(draft)}>
                        {t('common.save')}
                      </Button>
                      <Button
                        variant='ghost'
                        disabled={!canEdit}
                        onClick={() => revertBenefit(benefit.id)}
                      >
                        {t('payroll.revert')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
      <BpjsEnrollmentCard employeeId={employeeId} onDirtyChange={setBpjsDirty} />
    </>
  );
}

export function BankTab(ctx: TabContext) {
  const {
    t,
    canEdit,
    isPending,
    data,
    bankDrafts,
    setBankDrafts,
    newBankDraft,
    setNewBankDraft,
    saveBank,
    revertBank
  } = ctx;
  const emptyBank = {
    bankName: '',
    accountName: '',
    accountNumber: '',
    isPrimary: true,
    effectiveFrom: '',
    effectiveTo: ''
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payroll.bankHistory')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {data.bankAccounts.length === 0 || newBankDraft ? (
          newBankDraft ? (
            <div className='grid gap-3 sm:grid-cols-2'>
              <div>
                <Label htmlFor='new-bank-name'>{t('payroll.bank')}</Label>
                <Input
                  id='new-bank-name'
                  className='mt-1'
                  disabled={!canEdit}
                  placeholder={t('payroll.bank')}
                  value={newBankDraft.bankName}
                  onChange={(e) => setNewBankDraft({ ...newBankDraft, bankName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor='new-bank-account-name'>{t('payroll.accountName')}</Label>
                <Input
                  id='new-bank-account-name'
                  className='mt-1'
                  disabled={!canEdit}
                  placeholder={t('payroll.accountName')}
                  value={newBankDraft.accountName}
                  onChange={(e) =>
                    setNewBankDraft({ ...newBankDraft, accountName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor='new-bank-account-number'>{t('payroll.accountNumber')}</Label>
                <Input
                  id='new-bank-account-number'
                  className='mt-1'
                  disabled={!canEdit}
                  placeholder={t('payroll.accountNumber')}
                  value={newBankDraft.accountNumber}
                  onChange={(e) =>
                    setNewBankDraft({ ...newBankDraft, accountNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor='new-bank-effective-from'>{t('payroll.effectiveFrom')}</Label>
                <DatePicker
                  id='new-bank-effective-from'
                  className='mt-1'
                  disabled={!canEdit}
                  value={newBankDraft.effectiveFrom}
                  onChange={(date) =>
                    setNewBankDraft({ ...newBankDraft, effectiveFrom: date ?? '' })
                  }
                />
              </div>
              <div className='flex items-end gap-2 sm:col-span-2'>
                <Button disabled={!canEdit || isPending} onClick={() => saveBank(newBankDraft)}>
                  {t('common.save')}
                </Button>
                <Button variant='ghost' disabled={!canEdit} onClick={() => setNewBankDraft(null)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button disabled={!canEdit} onClick={() => setNewBankDraft(emptyBank)}>
              {t('payroll.addBankAccount')}
            </Button>
          )
        ) : (
          <>
            <Button disabled={!canEdit} onClick={() => setNewBankDraft(emptyBank)}>
              {t('payroll.addBankAccount')}
            </Button>
            {data.bankAccounts.map((bank) => {
              const draft = bankDrafts[bank.id];
              if (!draft) return null;
              return (
                <div className='space-y-3 rounded-lg border p-3' key={bank.id}>
                  <p className='text-sm'>
                    {bank.bank_name} {t('payroll.separator')} {maskBankAccount(bank.account_number)}{' '}
                    {t('payroll.separator')} {bank.account_name}
                  </p>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <div>
                      <Label htmlFor={`bank-name-${bank.id}`}>{t('payroll.bank')}</Label>
                      <Input
                        id={`bank-name-${bank.id}`}
                        className='mt-1'
                        disabled={!canEdit}
                        value={draft.bankName}
                        onChange={(e) =>
                          setBankDrafts({
                            ...bankDrafts,
                            [bank.id]: { ...draft, bankName: e.target.value }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`bank-account-name-${bank.id}`}>
                        {t('payroll.accountName')}
                      </Label>
                      <Input
                        id={`bank-account-name-${bank.id}`}
                        className='mt-1'
                        disabled={!canEdit}
                        value={draft.accountName}
                        onChange={(e) =>
                          setBankDrafts({
                            ...bankDrafts,
                            [bank.id]: { ...draft, accountName: e.target.value }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`bank-account-number-${bank.id}`}>
                        {t('payroll.accountNumber')}
                      </Label>
                      <Input
                        id={`bank-account-number-${bank.id}`}
                        className='mt-1'
                        disabled={!canEdit}
                        placeholder={t('payroll.reenterAccount')}
                        value={draft.accountNumber}
                        onChange={(e) =>
                          setBankDrafts({
                            ...bankDrafts,
                            [bank.id]: { ...draft, accountNumber: e.target.value }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`bank-effective-from-${bank.id}`}>
                        {t('payroll.effectiveFrom')}
                      </Label>
                      <DatePicker
                        id={`bank-effective-from-${bank.id}`}
                        className='mt-1'
                        disabled={!canEdit}
                        value={draft.effectiveFrom}
                        onChange={(date) =>
                          setBankDrafts({
                            ...bankDrafts,
                            [bank.id]: { ...draft, effectiveFrom: date ?? '' }
                          })
                        }
                      />
                    </div>
                    <div className='flex items-end gap-2 sm:col-span-2'>
                      <Button disabled={!canEdit || isPending} onClick={() => saveBank(draft)}>
                        {t('common.save')}
                      </Button>
                      <Button
                        variant='ghost'
                        disabled={!canEdit}
                        onClick={() => revertBank(bank.id)}
                      >
                        {t('payroll.revert')}
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
  );
}

export function HistoryTab(ctx: TabContext) {
  const { t, data } = ctx;
  return (
    <>
      <PaymentHistoryCard paymentHistory={data.paymentHistory} />
      <p className='text-xs text-muted-foreground'>{t('payroll.profileEditHint')}</p>
    </>
  );
}
