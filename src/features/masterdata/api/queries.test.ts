import { describe, expect, it, vi } from 'vitest';

vi.mock('./service', () => ({
  getDepartmentsFn: vi.fn(),
  getDesignationsFn: vi.fn(),
  getDesignationOptionsFn: vi.fn()
}));

import { masterdataKeys } from './queries';
import {
  departmentsQueryOptions,
  designationOptionsQueryOptions,
  designationsQueryOptions
} from './queries';
import { getDepartmentsFn, getDesignationOptionsFn, getDesignationsFn } from './service';

describe('masterdataKeys', () => {
  it('shapes query keys', () => {
    expect(masterdataKeys.all).toEqual(['masterdata']);
    expect(masterdataKeys.departments()).toEqual(['masterdata', 'departments']);
    expect(masterdataKeys.designations()).toEqual(['masterdata', 'designations', undefined]);
    expect(masterdataKeys.designations(3)).toEqual(['masterdata', 'designations', 3]);
    expect(masterdataKeys.designationOptions()).toEqual(['masterdata', 'designation-options']);
  });
});

describe('masterdata query options', () => {
  it('departmentsQueryOptions calls without args', () => {
    const options = departmentsQueryOptions();
    expect(options.queryKey).toEqual(['masterdata', 'departments']);
    options.queryFn!(undefined as never);
    expect(getDepartmentsFn).toHaveBeenCalledWith();
  });

  it('designationsQueryOptions without a department omits data', () => {
    const options = designationsQueryOptions();
    expect(options.queryKey).toEqual(['masterdata', 'designations', undefined]);
    options.queryFn!(undefined as never);
    expect(getDesignationsFn).toHaveBeenCalledWith({ data: undefined });
  });

  it('designationsQueryOptions with a department passes it through', () => {
    const options = designationsQueryOptions(3);
    expect(options.queryKey).toEqual(['masterdata', 'designations', 3]);
    options.queryFn!(undefined as never);
    expect(getDesignationsFn).toHaveBeenCalledWith({ data: { department_id: 3 } });
  });

  it('designationOptionsQueryOptions calls without args', () => {
    const options = designationOptionsQueryOptions();
    expect(options.queryKey).toEqual(['masterdata', 'designation-options']);
    options.queryFn!(undefined as never);
    expect(getDesignationOptionsFn).toHaveBeenCalledWith();
  });
});
