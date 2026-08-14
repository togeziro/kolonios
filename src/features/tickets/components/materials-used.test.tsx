// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import MaterialsUsed, { adjustQty, clampQty } from './materials-used';
import type { WorkSessionMaterialInput } from '../api/types';

const material = (patch: Partial<WorkSessionMaterialInput> = {}): WorkSessionMaterialInput => ({
  name: 'Drop cable',
  qty: 5,
  unit: 'm',
  source: 'van',
  ...patch
});

describe('materials-used helpers', () => {
  it('clamps qty between 1 and 999', () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(1000)).toBe(999);
    expect(clampQty(7)).toBe(7);
  });

  it('adjusts qty at an index without mutating input', () => {
    const before = [material({ qty: 1 })];
    const after = adjustQty(before, 0, 2);
    expect(after[0].qty).toBe(3);
    expect(before[0].qty).toBe(1);
  });

  it('never lowers qty below 1 via adjustQty', () => {
    const after = adjustQty([material({ qty: 1 })], 0, -1);
    expect(after[0].qty).toBe(1);
  });
});

describe('MaterialsUsed', () => {
  it('renders material rows with name, unit and qty', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MaterialsUsed materials={[material()]} onChange={() => {}} />
      </I18nextProvider>
    );
    expect(screen.getByText('Drop cable')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('fires onChange with incremented qty when + is clicked', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <MaterialsUsed materials={[material({ qty: 2 })]} onChange={onChange} />
      </I18nextProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(onChange).toHaveBeenCalledWith([material({ qty: 3 })]);
  });
});
