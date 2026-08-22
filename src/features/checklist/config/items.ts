export type ChecklistItemKey =
  | 'cekOlt'
  | 'cekAccu'
  | 'cekUispRadio'
  | 'cekTemp'
  | 'cekUps'
  | 'cekElectricMeter';

export const CHECKLIST_ITEMS: { key: ChecklistItemKey; icon: string }[] = [
  { key: 'cekOlt', icon: 'router' },
  { key: 'cekAccu', icon: 'batteryCharging' },
  { key: 'cekUispRadio', icon: 'radioTower' },
  { key: 'cekTemp', icon: 'thermometer' },
  { key: 'cekUps', icon: 'zap' },
  { key: 'cekElectricMeter', icon: 'gauge' }
];

export const CHECKLIST_ITEM_KEYS = CHECKLIST_ITEMS.map((i) => i.key);

export function isChecklistItemKey(key: string): key is ChecklistItemKey {
  return (CHECKLIST_ITEM_KEYS as string[]).includes(key);
}
