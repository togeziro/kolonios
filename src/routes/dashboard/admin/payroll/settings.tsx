import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { companyPayrollSettingsQueryOptions } from '@/features/payroll/api/queries';
import { useUpdateCompanyPayrollSettings } from '@/features/payroll/api/mutations';
import type { JkkRiskCategory, Pph21Method } from '@/features/payroll/api/types';
import type { CompanyPayrollSetting } from '@/lib/db/schema/payroll';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { canPayrollAction } from '@/features/payroll/components/permissions';

export const Route = createFileRoute('/dashboard/admin/payroll/settings')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.view' });
  },
  component: SettingsPage
});

interface SettingsForm {
  companyNpwp: string;
  cutOffDay: number;
  pph21Enabled: boolean;
  pph21Method: Pph21Method;
  jkkEnabled: boolean;
  jkmEnabled: boolean;
  jhtEnabled: boolean;
  jpEnabled: boolean;
  bpjsKesehatanEnabled: boolean;
  jkkRiskCategory: JkkRiskCategory;
  jkmCompanyRate: number;
  jhtCompanyRate: number;
  jhtEmployeeRate: number;
  jpCompanyRate: number;
  jpEmployeeRate: number;
  kesehatanCompanyRate: number;
  kesehatanEmployeeRate: number;
  potonganIzinJamDefault: number;
  potonganShortfallDefault: number;
}

const defaultForm: SettingsForm = {
  companyNpwp: '',
  cutOffDay: 7,
  pph21Enabled: true,
  pph21Method: 'gross',
  jkkEnabled: true,
  jkmEnabled: true,
  jhtEnabled: true,
  jpEnabled: true,
  bpjsKesehatanEnabled: true,
  jkkRiskCategory: 'low',
  jkmCompanyRate: 0.3,
  jhtCompanyRate: 3.7,
  jhtEmployeeRate: 2,
  jpCompanyRate: 2,
  jpEmployeeRate: 1,
  kesehatanCompanyRate: 4,
  kesehatanEmployeeRate: 1,
  potonganIzinJamDefault: 0,
  potonganShortfallDefault: 0
};

function mapSettings(settings: CompanyPayrollSetting | null): SettingsForm {
  return settings
    ? {
        companyNpwp: settings.company_npwp ?? '',
        cutOffDay: settings.cut_off_day,
        pph21Enabled: settings.pph21_enabled,
        pph21Method: settings.pph21_method,
        jkkEnabled: settings.jkk_enabled,
        jkmEnabled: settings.jkm_enabled,
        jhtEnabled: settings.jht_enabled,
        jpEnabled: settings.jp_enabled,
        bpjsKesehatanEnabled: settings.bpjs_kesehatan_enabled,
        jkkRiskCategory: settings.jkk_risk_category,
        jkmCompanyRate: Number(settings.jkm_company_rate),
        jhtCompanyRate: Number(settings.jht_company_rate),
        jhtEmployeeRate: Number(settings.jht_employee_rate),
        jpCompanyRate: Number(settings.jp_company_rate),
        jpEmployeeRate: Number(settings.jp_employee_rate),
        kesehatanCompanyRate: Number(settings.kesehatan_company_rate),
        kesehatanEmployeeRate: Number(settings.kesehatan_employee_rate),
        potonganIzinJamDefault: Number(settings.potongan_izin_jam_default),
        potonganShortfallDefault: Number(settings.potongan_shortfall_default)
      }
    : defaultForm;
}

const jkkCategories: JkkRiskCategory[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
const jkkCategoryKeys: Record<JkkRiskCategory, string> = {
  very_low: 'payroll.veryLow',
  low: 'payroll.low',
  medium: 'payroll.medium',
  high: 'payroll.high',
  very_high: 'payroll.veryHigh'
};

function SettingsPage() {
  const { t } = useTranslation();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canEdit = canPayrollAction(permissions, isAdmin, 'edit');
  const { data: settings, isLoading, isError } = useQuery(companyPayrollSettingsQueryOptions());
  const update = useUpdateCompanyPayrollSettings();
  const [form, setForm] = useState<SettingsForm>(defaultForm);

  useEffect(() => {
    if (settings) setForm(mapSettings(settings));
  }, [settings]);

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!canEdit || form.cutOffDay < 1 || form.cutOffDay > 31)
      return toast.error(t('payroll.failed'));
    try {
      await update.mutateAsync({
        companyNpwp: form.companyNpwp,
        cutOffDay: form.cutOffDay,
        pph21Enabled: form.pph21Enabled,
        pph21Method: form.pph21Method,
        jkkEnabled: form.jkkEnabled,
        jkmEnabled: form.jkmEnabled,
        jhtEnabled: form.jhtEnabled,
        jpEnabled: form.jpEnabled,
        bpjsKesehatanEnabled: form.bpjsKesehatanEnabled,
        jkkRiskCategory: form.jkkRiskCategory,
        jkmCompanyRate: form.jkmCompanyRate,
        jhtCompanyRate: form.jhtCompanyRate,
        jhtEmployeeRate: form.jhtEmployeeRate,
        jpCompanyRate: form.jpCompanyRate,
        jpEmployeeRate: form.jpEmployeeRate,
        kesehatanCompanyRate: form.kesehatanCompanyRate,
        kesehatanEmployeeRate: form.kesehatanEmployeeRate,
        potonganIzinJamDefault: form.potonganIzinJamDefault,
        potonganShortfallDefault: form.potonganShortfallDefault
      });
      toast.success(t('payroll.saved'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };

  const toggleRow = (label: string, checked: boolean, onChange: (value: boolean) => void) => (
    <div className='flex items-center justify-between rounded-md border p-3'>
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} disabled={!canEdit} />
    </div>
  );

  const numberField = (key: keyof SettingsForm, label: string, min = 0, step = '0.01') => (
    <div className='space-y-2'>
      <Label htmlFor={`settings-${key}`}>{label}</Label>
      <Input
        id={`settings-${key}`}
        type='number'
        min={min}
        step={step}
        disabled={!canEdit}
        value={form[key] as number}
        onChange={(e) => set(key, e.target.value === '' ? 0 : Number(e.target.value)) as void}
      />
    </div>
  );

  return (
    <PageContainer
      pageTitle={t('payroll.settings')}
      pageDescription={t('payroll.settingsDescription')}
    >
      <div className='grid max-w-4xl gap-4'>
        {isLoading ? (
          <p>{t('common.loading')}</p>
        ) : isError ? (
          <p className='text-sm text-destructive'>{t('payroll.loadFailed')}</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.dasar')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='space-y-2'>
                  <Label htmlFor='settings-companyNpwp'>{t('payroll.companyNpwp')}</Label>
                  <Input
                    id='settings-companyNpwp'
                    value={form.companyNpwp}
                    disabled={!canEdit}
                    onChange={(e) => set('companyNpwp', e.target.value)}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='settings-cutOffDay'>{t('payroll.cutOffDay')}</Label>
                  <Input
                    id='settings-cutOffDay'
                    type='number'
                    min={1}
                    max={31}
                    step={1}
                    disabled={!canEdit}
                    value={form.cutOffDay}
                    onChange={(e) =>
                      set('cutOffDay', e.target.value === '' ? 0 : Number(e.target.value))
                    }
                  />
                </div>
                {toggleRow(t('payroll.pph21Enabled'), form.pph21Enabled, (v) =>
                  set('pph21Enabled', v)
                )}
                <div className='space-y-2'>
                  <Label>{t('payroll.pph21Method')}</Label>
                  <Select
                    value={form.pph21Method}
                    disabled={!canEdit}
                    onValueChange={(v) => set('pph21Method', v as Pph21Method)}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='gross'>{t('payroll.gross')}</SelectItem>
                      <SelectItem value='gross_up'>{t('payroll.grossUp')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.bpjs')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {toggleRow(t('payroll.jkk'), form.jkkEnabled, (v) => set('jkkEnabled', v))}
                  {toggleRow(t('payroll.jkm'), form.jkmEnabled, (v) => set('jkmEnabled', v))}
                  {toggleRow(t('payroll.jht'), form.jhtEnabled, (v) => set('jhtEnabled', v))}
                  {toggleRow(t('payroll.jp'), form.jpEnabled, (v) => set('jpEnabled', v))}
                </div>
                <div className='space-y-2'>
                  <Label>{t('payroll.riskCategory')}</Label>
                  <Select
                    value={form.jkkRiskCategory}
                    disabled={!canEdit}
                    onValueChange={(v) => set('jkkRiskCategory', v as JkkRiskCategory)}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {jkkCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {t(jkkCategoryKeys[category])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {numberField('jkmCompanyRate', `${t('payroll.jkm')} ${t('payroll.companyRate')}`)}
                  {numberField('jhtCompanyRate', `${t('payroll.jht')} ${t('payroll.companyRate')}`)}
                  {numberField(
                    'jhtEmployeeRate',
                    `${t('payroll.jht')} ${t('payroll.employeeRate')}`
                  )}
                  {numberField('jpCompanyRate', `${t('payroll.jp')} ${t('payroll.companyRate')}`)}
                  {numberField('jpEmployeeRate', `${t('payroll.jp')} ${t('payroll.employeeRate')}`)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.bpjsKesehatan')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {toggleRow(t('payroll.bpjsKesehatan'), form.bpjsKesehatanEnabled, (v) =>
                  set('bpjsKesehatanEnabled', v)
                )}
                <div className='grid gap-3 sm:grid-cols-2'>
                  {numberField(
                    'kesehatanCompanyRate',
                    `${t('payroll.bpjsKesehatan')} ${t('payroll.companyRate')}`
                  )}
                  {numberField(
                    'kesehatanEmployeeRate',
                    `${t('payroll.bpjsKesehatan')} ${t('payroll.employeeRate')}`
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('payroll.potongan')}</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-3 sm:grid-cols-2'>
                  {numberField('potonganIzinJamDefault', t('payroll.potonganIzinJamDefault'))}
                  {numberField('potonganShortfallDefault', t('payroll.potonganShortfallDefault'))}
                </div>
              </CardContent>
            </Card>

            <div>
              <Button onClick={save} disabled={!canEdit || update.isPending || !settings}>
                {t('common.save')}
              </Button>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
