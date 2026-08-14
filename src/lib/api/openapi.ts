import type { ZodTypeAny } from 'zod';
import {
  customerFiltersSchema,
  customerIdSchema,
  customerMutationSchema
} from '@/features/customers/api/validation';
import {
  employeeFiltersSchema,
  employeeIdSchema,
  employeeMutationSchema
} from '@/features/employees/api/validation';
import {
  attendanceCheckInSchema,
  attendanceCheckOutSchema,
  attendanceFiltersSchema,
  dateParamSchema,
  leaveFiltersSchema,
  leaveRequestSchema
} from '@/features/attendance/api/validation';
import {
  departmentCreateSchema,
  departmentUpdateSchema,
  departmentDeleteSchema,
  designationFilterSchema,
  designationCreateSchema,
  designationUpdateSchema,
  designationDeleteSchema
} from '@/features/masterdata/api/validation';
import {
  markAsReadSchema,
  removeNotificationSchema,
  addNotificationSchema
} from '@/features/notifications/api/validation';
import {
  userFiltersSchema,
  userIdSchema,
  userMutationSchema
} from '@/features/users/api/validation';
import {
  ticketIdSchema,
  listOpenTicketsSchema,
  createTicketSchema,
  legIdSchema
} from '@/features/tickets/api/validation';

export type Operation = {
  operationId: string;
  method: 'get' | 'post';
  path: string;
  summary: string;
  permission: string;
  pathParams?: Record<string, ZodTypeAny>;
  queryParams?: Record<string, ZodTypeAny>;
  body?: ZodTypeAny;
  responseDescription: string;
};

const asId = (schema: ZodTypeAny): Record<string, ZodTypeAny> => ({ id: schema });

const asQuery = (schema: ZodTypeAny): Record<string, ZodTypeAny> =>
  (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape;

export const operations: Operation[] = [
  // Customers
  {
    operationId: 'listCustomers',
    method: 'get',
    path: '/customers',
    summary: 'List customers (search, filter, paginate)',
    permission: 'customers.view',
    queryParams: asQuery(customerFiltersSchema),
    responseDescription: 'Paginated customer list'
  },
  {
    operationId: 'getCustomerById',
    method: 'get',
    path: '/customers/{id}',
    summary: 'Get a single customer',
    permission: 'customers.view',
    pathParams: asId(customerIdSchema),
    responseDescription: 'Customer details'
  },
  {
    operationId: 'createCustomer',
    method: 'post',
    path: '/customers',
    summary: 'Create a customer (auto-generates code)',
    permission: 'customers.add',
    body: customerMutationSchema,
    responseDescription: 'Created customer'
  },
  {
    operationId: 'updateCustomer',
    method: 'post',
    path: '/customers/{id}',
    summary: 'Update a customer',
    permission: 'customers.edit',
    pathParams: asId(customerIdSchema),
    body: customerMutationSchema,
    responseDescription: 'Updated customer'
  },
  {
    operationId: 'deleteCustomer',
    method: 'post',
    path: '/customers/{id}/delete',
    summary: 'Delete a customer',
    permission: 'customers.delete',
    pathParams: asId(customerIdSchema),
    responseDescription: 'Success acknowledgement'
  },

  // Employees
  {
    operationId: 'listEmployees',
    method: 'get',
    path: '/employees',
    summary: 'List employees (search, filter, paginate)',
    permission: 'employees.view',
    queryParams: asQuery(employeeFiltersSchema),
    responseDescription: 'Paginated employee list'
  },
  {
    operationId: 'getEmployeeById',
    method: 'get',
    path: '/employees/{id}',
    summary: 'Get a single employee',
    permission: 'employees.view',
    pathParams: asId(employeeIdSchema),
    responseDescription: 'Employee details'
  },
  {
    operationId: 'createEmployee',
    method: 'post',
    path: '/employees',
    summary: 'Create an employee',
    permission: 'employees.add',
    body: employeeMutationSchema,
    responseDescription: 'Created employee'
  },
  {
    operationId: 'updateEmployee',
    method: 'post',
    path: '/employees/{id}',
    summary: 'Update an employee',
    permission: 'employees.edit',
    pathParams: asId(employeeIdSchema),
    body: employeeMutationSchema,
    responseDescription: 'Updated employee'
  },
  {
    operationId: 'deleteEmployee',
    method: 'post',
    path: '/employees/{id}/delete',
    summary: 'Delete an employee',
    permission: 'employees.delete',
    pathParams: asId(employeeIdSchema),
    responseDescription: 'Success acknowledgement'
  },

  // Users
  {
    operationId: 'getUsers',
    method: 'get',
    path: '/users',
    summary: 'List users (search, filter, paginate)',
    permission: 'users.view',
    queryParams: asQuery(userFiltersSchema),
    responseDescription: 'Paginated user list'
  },
  {
    operationId: 'createUser',
    method: 'post',
    path: '/users',
    summary: 'Create a user',
    permission: 'users.add',
    body: userMutationSchema,
    responseDescription: 'Created user'
  },
  {
    operationId: 'updateUser',
    method: 'post',
    path: '/users/{id}',
    summary: 'Update a user',
    permission: 'users.edit',
    pathParams: asId(userIdSchema),
    body: userMutationSchema,
    responseDescription: 'Updated user'
  },
  {
    operationId: 'deleteUser',
    method: 'post',
    path: '/users/{id}/delete',
    summary: 'Delete a user',
    permission: 'users.delete',
    pathParams: asId(userIdSchema),
    responseDescription: 'Success acknowledgement'
  },

  // Attendance
  {
    operationId: 'checkIn',
    method: 'post',
    path: '/attendance/check-in',
    summary: 'Check in with geo-fencing validation',
    permission: 'attendance.view',
    body: attendanceCheckInSchema,
    responseDescription: 'Attendance record'
  },
  {
    operationId: 'checkOut',
    method: 'post',
    path: '/attendance/check-out',
    summary: 'Check out with geo-fencing validation',
    permission: 'attendance.view',
    body: attendanceCheckOutSchema,
    responseDescription: 'Attendance record'
  },
  {
    operationId: 'getMyAttendance',
    method: 'get',
    path: '/attendance/me',
    summary: "Get the caller's attendance for a date",
    permission: 'attendance.view',
    queryParams: { date: dateParamSchema },
    responseDescription: 'Attendance status'
  },
  {
    operationId: 'getAttendanceHistory',
    method: 'get',
    path: '/attendance/history',
    summary: "Get the caller's attendance history",
    permission: 'attendance.view',
    queryParams: asQuery(attendanceFiltersSchema),
    responseDescription: 'Paginated attendance history'
  },

  // Leave
  {
    operationId: 'getMyLeaves',
    method: 'get',
    path: '/leave',
    summary: "Get the caller's leave requests",
    permission: 'leave.view',
    queryParams: asQuery(leaveFiltersSchema),
    responseDescription: 'Paginated leave list'
  },
  {
    operationId: 'createLeaveRequest',
    method: 'post',
    path: '/leave',
    summary: 'Create a leave request',
    permission: 'leave.view',
    body: leaveRequestSchema,
    responseDescription: 'Created leave request'
  },

  // Masterdata
  {
    operationId: 'getDepartments',
    method: 'get',
    path: '/departments',
    summary: 'List departments',
    permission: 'departments.view',
    responseDescription: 'Department list'
  },
  {
    operationId: 'createDepartment',
    method: 'post',
    path: '/departments',
    summary: 'Create a department',
    permission: 'departments.add',
    body: departmentCreateSchema,
    responseDescription: 'Created department'
  },
  {
    operationId: 'updateDepartment',
    method: 'post',
    path: '/departments/{id}',
    summary: 'Update a department',
    permission: 'departments.edit',
    pathParams: asId(departmentUpdateSchema.shape.id),
    body: departmentUpdateSchema,
    responseDescription: 'Updated department'
  },
  {
    operationId: 'deleteDepartment',
    method: 'post',
    path: '/departments/{id}/delete',
    summary: 'Delete a department',
    permission: 'departments.delete',
    pathParams: asId(departmentDeleteSchema.shape.id),
    body: departmentDeleteSchema,
    responseDescription: 'Success acknowledgement'
  },
  {
    operationId: 'getDesignations',
    method: 'get',
    path: '/designations',
    summary: 'List designations (optionally by department)',
    permission: 'designations.view',
    queryParams: asQuery(designationFilterSchema),
    responseDescription: 'Designation list'
  },
  {
    operationId: 'createDesignation',
    method: 'post',
    path: '/designations',
    summary: 'Create a designation',
    permission: 'designations.add',
    body: designationCreateSchema,
    responseDescription: 'Created designation'
  },
  {
    operationId: 'updateDesignation',
    method: 'post',
    path: '/designations/{id}',
    summary: 'Update a designation',
    permission: 'designations.edit',
    pathParams: asId(designationUpdateSchema.shape.id),
    body: designationUpdateSchema,
    responseDescription: 'Updated designation'
  },
  {
    operationId: 'deleteDesignation',
    method: 'post',
    path: '/designations/{id}/delete',
    summary: 'Delete a designation',
    permission: 'designations.delete',
    pathParams: asId(designationDeleteSchema.shape.id),
    body: designationDeleteSchema,
    responseDescription: 'Success acknowledgement'
  },

  // Notifications
  {
    operationId: 'getNotifications',
    method: 'get',
    path: '/notifications',
    summary: "List the caller's notifications",
    permission: 'notifications.view',
    responseDescription: 'Notification list'
  },
  {
    operationId: 'markNotificationAsRead',
    method: 'post',
    path: '/notifications/{id}/read',
    summary: 'Mark a notification as read',
    permission: 'notifications.view',
    pathParams: asId(markAsReadSchema.shape.id),
    responseDescription: 'Success flag'
  },
  {
    operationId: 'markAllNotificationsRead',
    method: 'post',
    path: '/notifications/read-all',
    summary: 'Mark all notifications as read',
    permission: 'notifications.view',
    responseDescription: 'Success flag'
  },
  {
    operationId: 'addNotification',
    method: 'post',
    path: '/notifications',
    summary: 'Create a notification',
    permission: 'notifications.view',
    body: addNotificationSchema,
    responseDescription: 'Created notification'
  },
  {
    operationId: 'removeNotification',
    method: 'post',
    path: '/notifications/{id}/delete',
    summary: 'Remove a notification',
    permission: 'notifications.view',
    pathParams: asId(removeNotificationSchema.shape.id),
    responseDescription: 'Success flag'
  },

  // Tickets
  {
    operationId: 'getMyTickets',
    method: 'get',
    path: '/tickets/my-work',
    summary: "Get the caller's assigned tickets",
    permission: 'my_work.view',
    responseDescription: 'Assigned ticket list'
  },
  {
    operationId: 'listOpenTickets',
    method: 'get',
    path: '/tickets/open',
    summary: 'List open tickets (eligibility-gated)',
    permission: 'jobs.view',
    queryParams: asQuery(listOpenTicketsSchema),
    responseDescription: 'Open ticket pool'
  },
  {
    operationId: 'getTicketDetail',
    method: 'get',
    path: '/tickets/{ticketId}',
    summary: 'Get ticket detail',
    permission: 'tickets.view',
    pathParams: { ticketId: ticketIdSchema.shape.ticketId },
    responseDescription: 'Ticket detail'
  },
  {
    operationId: 'takeTicket',
    method: 'post',
    path: '/tickets/{ticketId}/take',
    summary: 'Claim an open ticket',
    permission: 'tickets.edit',
    pathParams: { ticketId: ticketIdSchema.shape.ticketId },
    responseDescription: 'Claimed ticket'
  },
  {
    operationId: 'completeTicket',
    method: 'post',
    path: '/tickets/{ticketId}/complete',
    summary: 'Complete an assigned ticket',
    permission: 'tickets.edit',
    pathParams: { ticketId: ticketIdSchema.shape.ticketId },
    responseDescription: 'Completed ticket'
  },
  {
    operationId: 'startLeg',
    method: 'post',
    path: '/tickets/legs/{legId}/start',
    summary: 'Start an assigned leg (ticket taken by caller)',
    permission: 'tickets.edit',
    pathParams: { legId: legIdSchema.shape.legId },
    responseDescription: 'Started leg'
  },
  {
    operationId: 'createTicket',
    method: 'post',
    path: '/tickets',
    summary: 'Create a ticket with optional estafet legs',
    permission: 'tickets.add',
    body: createTicketSchema,
    responseDescription: 'Created ticket detail'
  }
];

export const openApiInfo = {
  title: 'Kolonios API',
  version: '1.0.0',
  license: { name: 'MIT' },
  description:
    'Server-function RPC surface of the Kolonios ISP / property-management dashboard. ' +
    'Every operation requires an authenticated session (cookie `session`) and the listed ' +
    'permission from the caller\u2019s role group (see docs/API.md). The `admin` role bypasses the matrix.'
};
