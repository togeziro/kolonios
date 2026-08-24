import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { validDates } from './-components';
import {
  type Assignment,
  type BenefitDraft,
  type BankDraft,
  type ComponentDraft,
  type DraftState,
  type ProfileData,
  type ProfileMutation,
  draftSnapshotFromData,
  profileRecordId,
  snapshotsEqual
} from './-profile-types';
import type { TaxDraft } from './-profile-tax-history';

export type UseProfileDraftsResult = {
  assignment: Assignment | null;
  setAssignment: React.Dispatch<React.SetStateAction<Assignment | null>>;
  componentDrafts: Record<number, ComponentDraft>;
  setComponentDrafts: React.Dispatch<React.SetStateAction<Record<number, ComponentDraft>>>;
  taxDrafts: Record<number, TaxDraft>;
  setTaxDrafts: React.Dispatch<React.SetStateAction<Record<number, TaxDraft>>>;
  benefitDrafts: Record<number, BenefitDraft>;
  setBenefitDrafts: React.Dispatch<React.SetStateAction<Record<number, BenefitDraft>>>;
  bankDrafts: Record<number, BankDraft>;
  setBankDrafts: React.Dispatch<React.SetStateAction<Record<number, BankDraft>>>;
  newTaxDraft: TaxDraft | null;
  setNewTaxDraft: React.Dispatch<React.SetStateAction<TaxDraft | null>>;
  newBenefitDraft: BenefitDraft | null;
  setNewBenefitDraft: React.Dispatch<React.SetStateAction<BenefitDraft | null>>;
  newBankDraft: BankDraft | null;
  setNewBankDraft: React.Dispatch<React.SetStateAction<BankDraft | null>>;
  newComponentDraft: ComponentDraft | null;
  setNewComponentDraft: React.Dispatch<React.SetStateAction<ComponentDraft | null>>;
  pendingAssignment: Assignment | null;
  setPendingAssignment: React.Dispatch<React.SetStateAction<Assignment | null>>;
  bpjsDirty: boolean;
  setBpjsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  dirty: boolean;
  resetDrafts: (snapshot?: DraftState | null) => void;
  revertComponent: (id: number) => void;
  revertTax: (id: number) => void;
  revertBenefit: (id: number) => void;
  revertBank: (id: number) => void;
  saveAssignment: () => void;
  requestSalarySave: () => void;
  saveComponent: (draft: ComponentDraft) => void;
  saveTax: (draft: TaxDraft) => void;
  saveBenefit: (draft: BenefitDraft) => void;
  saveBank: (draft: BankDraft) => void;
};

type UseProfileDraftsOptions = {
  data: ProfileData | undefined;
  employeeId: string;
  update: {
    mutateAsync: (payload: ProfileMutation) => Promise<unknown>;
    isPending: boolean;
  };
};

export function useProfileDrafts(options: UseProfileDraftsOptions): UseProfileDraftsResult {
  const { data, employeeId, update } = options;
  const { t } = useTranslation();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [componentDrafts, setComponentDrafts] = useState<Record<number, ComponentDraft>>({});
  const [taxDrafts, setTaxDrafts] = useState<Record<number, TaxDraft>>({});
  const [benefitDrafts, setBenefitDrafts] = useState<Record<number, BenefitDraft>>({});
  const [bankDrafts, setBankDrafts] = useState<Record<number, BankDraft>>({});
  const [newTaxDraft, setNewTaxDraft] = useState<TaxDraft | null>(null);
  const [newBenefitDraft, setNewBenefitDraft] = useState<BenefitDraft | null>(null);
  const [newBankDraft, setNewBankDraft] = useState<BankDraft | null>(null);
  const [newComponentDraft, setNewComponentDraft] = useState<ComponentDraft | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<Assignment | null>(null);
  const [bpjsDirty, setBpjsDirty] = useState(false);
  const [baseline, setBaseline] = useState<DraftState | null>(null);

  // Reset all drafts whenever a new profile payload arrives
  // (adjust-state-during-render pattern; replaces the previous effect).
  const [prevData, setPrevData] = useState<ProfileData | undefined>(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      const snapshot = draftSnapshotFromData(data);
      setAssignment(snapshot.assignment);
      setComponentDrafts(snapshot.componentDrafts);
      setTaxDrafts(snapshot.taxDrafts);
      setBenefitDrafts(snapshot.benefitDrafts);
      setBankDrafts(snapshot.bankDrafts);
      setBaseline(snapshot);
    }
  }

  const save = async (payload: ProfileMutation) => {
    try {
      await update.mutateAsync(payload);
      if (payload.kind === 'component') setNewComponentDraft(null);
      if (payload.kind === 'tax') setNewTaxDraft(null);
      if (payload.kind === 'benefit') setNewBenefitDraft(null);
      if (payload.kind === 'bank') setNewBankDraft(null);
      toast.success(t('payroll.saved'));
    } catch {
      toast.error(t('payroll.failed'));
    }
  };

  const currentSnapshot = useMemo<DraftState>(
    () => ({
      assignment,
      componentDrafts,
      taxDrafts,
      benefitDrafts,
      bankDrafts,
      newComponentDraft,
      newTaxDraft,
      newBenefitDraft,
      newBankDraft
    }),
    [
      assignment,
      componentDrafts,
      taxDrafts,
      benefitDrafts,
      bankDrafts,
      newComponentDraft,
      newTaxDraft,
      newBenefitDraft,
      newBankDraft
    ]
  );

  // Derived from the current drafts vs the last saved/loaded baseline.
  const dirty = baseline ? !snapshotsEqual(currentSnapshot, baseline) : false;

  const resetDrafts = (snapshot?: DraftState | null) => {
    const next = snapshot ?? (data ? draftSnapshotFromData(data) : currentSnapshot);
    setAssignment(next.assignment);
    setComponentDrafts(next.componentDrafts);
    setTaxDrafts(next.taxDrafts);
    setBenefitDrafts(next.benefitDrafts);
    setBankDrafts(next.bankDrafts);
    setNewComponentDraft(null);
    setNewTaxDraft(null);
    setNewBenefitDraft(null);
    setNewBankDraft(null);
    setBaseline(next);
  };

  const revertComponent = (id: number) => {
    if (!data) return;
    setComponentDrafts((prev) => ({
      ...prev,
      [id]: draftSnapshotFromData(data).componentDrafts[id]
    }));
  };
  const revertTax = (id: number) => {
    if (!data) return;
    setTaxDrafts((prev) => ({ ...prev, [id]: draftSnapshotFromData(data).taxDrafts[id] }));
  };
  const revertBenefit = (id: number) => {
    if (!data) return;
    setBenefitDrafts((prev) => ({ ...prev, [id]: draftSnapshotFromData(data).benefitDrafts[id] }));
  };
  const revertBank = (id: number) => {
    if (!data) return;
    setBankDrafts((prev) => ({ ...prev, [id]: draftSnapshotFromData(data).bankDrafts[id] }));
  };

  const saveAssignment = () => {
    if (!pendingAssignment) return;
    setPendingAssignment(null);
    const current = pendingAssignment;
    if (!validDates(current.effective_from, current.effective_to ?? ''))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'assignment',
      values: {
        id: profileRecordId(current.id),
        salaryType: current.salary_type,
        amount: current.amount,
        effectiveFrom: current.effective_from,
        effectiveTo: current.effective_to ?? undefined,
        departmentId: current.department_id ?? undefined,
        designationId: current.designation_id ?? undefined
      }
    });
  };
  const requestSalarySave = () => {
    if (!assignment || !validDates(assignment.effective_from, assignment.effective_to ?? ''))
      return toast.error(t('payroll.invalidProfile'));
    setPendingAssignment(assignment);
  };
  const saveComponent = (draft: ComponentDraft) => {
    if (!validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'component',
      values: {
        id: profileRecordId(draft.id),
        assignmentId: draft.assignmentId,
        salaryComponentId: draft.salaryComponentId,
        amount: draft.amount,
        mode: draft.mode,
        percentageBase: draft.percentageBase,
        attendanceMetric: draft.attendanceMetric,
        taxable: draft.taxable,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      }
    });
  };
  const saveTax = (draft: TaxDraft) => {
    if (!validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'tax',
      values: {
        id: profileRecordId(draft.id),
        taxSettingId: draft.taxSettingId,
        taxIdentifier: draft.taxIdentifier || undefined,
        filingStatus: draft.filingStatus || undefined,
        employmentStatus: draft.employmentStatus || undefined,
        ptkpStatus: draft.ptkpStatus || undefined,
        residency: draft.residency || undefined,
        taxFacility: draft.taxFacility || undefined,
        taxObjectCode: draft.taxObjectCode || undefined,
        pph21Method: draft.pph21Method || undefined,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      }
    });
  };
  const saveBenefit = (draft: BenefitDraft) => {
    if (!validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.invalidProfile'));
    void save({
      employeeId,
      kind: 'benefit',
      values: {
        id: profileRecordId(draft.id),
        benefitCode: draft.benefitCode,
        benefitName: draft.benefitName,
        amount: draft.amount || undefined,
        status: draft.status,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      }
    });
  };
  const saveBank = (draft: BankDraft) => {
    if (!draft.accountNumber || !validDates(draft.effectiveFrom, draft.effectiveTo))
      return toast.error(t('payroll.bankAccountRequired'));
    void save({
      employeeId,
      kind: 'bank',
      values: {
        id: profileRecordId(draft.id),
        bankName: draft.bankName,
        accountName: draft.accountName,
        accountNumber: draft.accountNumber,
        isPrimary: draft.isPrimary,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined
      }
    });
  };

  return {
    assignment,
    setAssignment,
    componentDrafts,
    setComponentDrafts,
    taxDrafts,
    setTaxDrafts,
    benefitDrafts,
    setBenefitDrafts,
    bankDrafts,
    setBankDrafts,
    newTaxDraft,
    setNewTaxDraft,
    newBenefitDraft,
    setNewBenefitDraft,
    newBankDraft,
    setNewBankDraft,
    newComponentDraft,
    setNewComponentDraft,
    pendingAssignment,
    setPendingAssignment,
    bpjsDirty,
    setBpjsDirty,
    dirty,
    resetDrafts,
    revertComponent,
    revertTax,
    revertBenefit,
    revertBank,
    saveAssignment,
    requestSalarySave,
    saveComponent,
    saveTax,
    saveBenefit,
    saveBank
  };
}
