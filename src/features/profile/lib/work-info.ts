/**
 * Work-information DTO for the signed-in user, as returned by
 * `getMyEmployeeFn` (self-scoped employee record; no salary/status fields).
 */
export interface MyWorkInfo {
  employeeCode: string;
  department: string;
  jobTitle: string;
}
