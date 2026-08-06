import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useOverrideEmployeeTaxRecord } from '@/features/payroll/api/mutations';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';
import { formatPayrollMoney } from './-components';

export type TaxRecord = {
  id: number;
  employee_id: string;
  payroll_record_id: number | null;
  tax_period: string;
  taxable_income: string;
  tax_amount: string;
  details: unknown;
  source: 'calculated' | 'manual';
  is_overridden: boolean;
  created_at: string;
};

export type TaxDraft = {
  id?: number;
  taxSettingId?: number;
  taxIdentifier: string;
  filingStatus: string;
  employmentStatus: 'permanent' | 'contract' | 'freelance' | '';
  ptkpStatus: 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3' | '';
  residency: 'resident' | 'foreign' | '';
  taxFacility: 'none' | 'dtp' | 'etc' | '';
  taxObjectCode: '21-100-01' | '21-100-02' | '21-100-32' | '';
  pph21Method: 'gross' | 'gross_up' | '';
  effectiveFrom: string;
  effectiveTo: string;
};

export type TaxSelectKey =
  | 'employmentStatus'
  | 'ptkpStatus'
  | 'residency'
  | 'taxFacility'
  | 'taxObjectCode'
  | 'pph21Method';

const TAX_EMPLOYMENT_STATUS_OPTIONS = ['permanent', 'contract', 'freelance'] as const;
const TAX_PTKP_STATUS_OPTIONS = [
  'TK/0',
  'TK/1',
  'TK/2',
  'TK/3',
  'K/0',
  'K/1',
  'K/2',
  'K/3'
] as const;
const TAX_RESIDENCY_OPTIONS = ['resident', 'foreign'] as const;
const TAX_FACILITY_OPTIONS = ['none', 'dtp', 'etc'] as const;
const TAX_OBJECT_CODE_OPTIONS = ['21-100-01', '21-100-02', '21-100-32'] as const;
const TAX_PPH21_METHOD_OPTIONS = ['gross', 'gross_up'] as const;

const TAX_SELECT_FIELDS: {
  key: TaxSelectKey;
  ariaLabelKey: string;
  options: readonly string[];
  render?: (t: TFunction, option: string) => string;
}[] = [
  {
    key: 'employmentStatus',
    ariaLabelKey: 'payroll.employmentStatus',
    options: TAX_EMPLOYMENT_STATUS_OPTIONS,
    render: (t, option) => t(`payroll.${option}`)
  },
  {
    key: 'ptkpStatus',
    ariaLabelKey: 'payroll.ptkpStatus',
    options: TAX_PTKP_STATUS_OPTIONS
  },
  {
    key: 'residency',
    ariaLabelKey: 'payroll.residency',
    options: TAX_RESIDENCY_OPTIONS,
    render: (t, option) => t(`payroll.${option}`)
  },
  {
    key: 'taxFacility',
    ariaLabelKey: 'payroll.taxFacility',
    options: TAX_FACILITY_OPTIONS,
    render: (t, option) => t(`payroll.${option}`)
  },
  {
    key: 'taxObjectCode',
    ariaLabelKey: 'payroll.taxObjectCode',
    options: TAX_OBJECT_CODE_OPTIONS
  },
  {
    key: 'pph21Method',
    ariaLabelKey: 'payroll.pph21Method',
    options: TAX_PPH21_METHOD_OPTIONS,
    render: (t, option) => t(`payroll.${option === 'gross_up' ? 'grossUp' : 'gross'}`)
  }
];

export function TaxProfileSelects({
  value,
  onChange,
  disabled
}: {
  value: TaxDraft;
  onChange: (next: TaxDraft) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {TAX_SELECT_FIELDS.map(({ key, ariaLabelKey, options, render }) => (
        <NativeSelect
          key={key}
          disabled={disabled}
          className='px-2'
          aria-label={t(ariaLabelKey)}
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value as TaxDraft[TaxSelectKey] })}
        >
          <option value=''>{t('payroll.select')}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {render ? render(t, option) : option}
            </option>
          ))}
        </NativeSelect>
      ))}
    </>
  );
}

export function TaxHistoryCard({ taxRecords }: { taxRecords: TaxRecord[] }) {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canEdit = canPayrollAction(permissions, isAdmin, 'edit');
  const overrideTax = useOverrideEmployeeTaxRecord();
  const [taxOverrideDrafts, setTaxOverrideDrafts] = useState<Record<number, string>>({});

  const saveTaxOverride = (record: TaxRecord) => {
    const amount = taxOverrideDrafts[record.id];
    if (!amount) return toast.error(t('payroll.invalidProfile'));
    void overrideTax
      .mutateAsync({ id: record.id, amount })
      .then(() => {
        setTaxOverrideDrafts((prev) => {
          const next = { ...prev };
          delete next[record.id];
          return next;
        });
        toast.success(t('payroll.updated'));
      })
      .catch(() => toast.error(t('payroll.failed')));
  };
  const cancelTaxOverride = (id: number) =>
    setTaxOverrideDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payroll.taxHistory')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payroll.taxPeriod')}</TableHead>
                <TableHead className='text-right'>{t('payroll.taxableIncome')}</TableHead>
                <TableHead className='text-right'>{t('payroll.taxAmount')}</TableHead>
                <TableHead>{t('payroll.source')}</TableHead>
                <TableHead className='text-right'>{t('payroll.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-center text-muted-foreground'>
                    {t('payroll.noTaxHistory')}
                  </TableCell>
                </TableRow>
              ) : (
                taxRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.tax_period}</TableCell>
                    <TableCell className='text-right'>
                      {formatPayrollMoney(record.taxable_income)}
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatPayrollMoney(record.tax_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.source === 'manual' ? 'secondary' : 'outline'}>
                        {record.source === 'manual' ? t('payroll.manual') : t('payroll.calculated')}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      {taxOverrideDrafts[record.id] !== undefined ? (
                        <div className='flex items-center justify-end gap-2'>
                          <Input
                            className='w-32'
                            aria-label={t('payroll.taxAmount')}
                            value={taxOverrideDrafts[record.id]}
                            onChange={(e) =>
                              setTaxOverrideDrafts({
                                ...taxOverrideDrafts,
                                [record.id]: e.target.value
                              })
                            }
                          />
                          <Button
                            size='sm'
                            disabled={!canEdit || overrideTax.isPending}
                            onClick={() => saveTaxOverride(record)}
                          >
                            {t('common.save')}
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => cancelTaxOverride(record.id)}
                          >
                            {t('common.cancel')}
                          </Button>
                        </div>
                      ) : record.source === 'calculated' && canEdit ? (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() =>
                            setTaxOverrideDrafts({
                              ...taxOverrideDrafts,
                              [record.id]: record.tax_amount
                            })
                          }
                        >
                          {t('payroll.override')}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
