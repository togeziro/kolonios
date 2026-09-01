// Fixed hex presets for shift master. Chosen for accessibility (foreground
// contrast) and a calm UI palette — no free-form picker. Empty string in
// the DB means "neutral" (no swatch).

export interface ShiftColorPreset {
  hex: string;
  label: string;
}

export const SHIFT_COLOR_PRESETS: readonly ShiftColorPreset[] = [
  { hex: '#64748b', label: 'Slate' },
  { hex: '#0ea5e9', label: 'Sky' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#ef4444', label: 'Rose' },
  { hex: '#a855f7', label: 'Violet' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#6366f1', label: 'Indigo' }
] as const;

export function findShiftColorPreset(hex: string | null | undefined): ShiftColorPreset | null {
  if (!hex) return null;
  return SHIFT_COLOR_PRESETS.find((p) => p.hex.toLowerCase() === hex.toLowerCase()) ?? null;
}
