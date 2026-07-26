import { queryOptions } from '@tanstack/react-query';
import { getDepartmentsFn, getDesignationsFn, getDesignationOptionsFn } from './service';

export const masterdataKeys = {
  all: ['masterdata'] as const,
  departments: () => [...masterdataKeys.all, 'departments'] as const,
  designations: (departmentId?: number) =>
    [...masterdataKeys.all, 'designations', departmentId] as const,
  designationOptions: () => [...masterdataKeys.all, 'designation-options'] as const
};

export const departmentsQueryOptions = () =>
  queryOptions({
    queryKey: masterdataKeys.departments(),
    queryFn: () => getDepartmentsFn()
  });

export const designationsQueryOptions = (departmentId?: number) =>
  queryOptions({
    queryKey: masterdataKeys.designations(departmentId),
    queryFn: () =>
      getDesignationsFn({ data: departmentId ? { department_id: departmentId } : undefined })
  });

export const designationOptionsQueryOptions = () =>
  queryOptions({
    queryKey: masterdataKeys.designationOptions(),
    queryFn: () => getDesignationOptionsFn()
  });
