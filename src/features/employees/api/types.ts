export type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  nickname: string;
  email: string;
  phone: string;
  birth_place: string;
  birth_date: string;
  address: string;
  id_number: string;
  department_id: number;
  designation_id: number;
  is_internship: boolean;
  employment_status: string;
  join_date: string;
  leave_date: string | null;
  base_salary: number;
  status: string;
  created_at: string;
  updated_at: string;
  department_name: string;
  designation_name: string;
};

export type EmployeeFilters = {
  page?: number;
  limit?: number;
  search?: string;
  department_id?: number;
  status?: string;
  sort?: string;
};

export type EmployeesResponse = {
  success: boolean;
  time: string;
  message: string;
  total_employees: number;
  offset: number;
  limit: number;
  employees: Employee[];
};

export type EmployeeByIdResponse = {
  success: boolean;
  time: string;
  message: string;
  employee: Employee;
};

export type EmployeeMutationPayload = {
  full_name: string;
  nickname?: string;
  email: string;
  phone?: string;
  birth_place?: string;
  birth_date: string;
  address?: string;
  id_number?: string;
  department_id: number;
  designation_id: number;
  is_internship?: boolean;
  employment_status?: string;
  join_date: string;
  leave_date?: string | null;
  base_salary?: number;
  status?: string;
};
