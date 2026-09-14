export type User = {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  role_group_id: string | null;
  role_group_name: string | null;
  /**
   * True when an `employees` row exists for this `user.id`. `users` and
   * `employees` are separate tables by design (identity vs HR profile);
   * users created via `/dashboard/users` have no employee row until an
   * admin completes the profile in `/dashboard/employees`. Used by the
   * users table to flag gaps and by the assignments page to surface a
   * warning when bulk-assigning would silently skip those users.
   */
  has_employee_profile: boolean;
  created_at: string;
  updated_at: string;
};

export type UserFilters = {
  page?: number;
  limit?: number;
  roles?: string;
  search?: string;
  sort?: string;
  status?: string;
};

export type UsersResponse = {
  success: boolean;
  time: string;
  message: string;
  total_users: number;
  offset: number;
  limit: number;
  users: User[];
};

export type UserMutationPayload = {
  name: string;
  email: string;
  role?: string;
  role_group_id?: string;
  status: string;
  /**
   * Admin-set initial password. Optional: when omitted, the server generates
   * a temporary one and returns it ONCE in the create response so the admin
   * can share it out-of-band. Update ignores it. Never echoed back afterwards
   * and never audited.
   */
  password?: string;
};

export type CreatedUser = {
  success: true;
  message: string;
  user: User;
  /**
   * Present only when the server generated the password (admin left the
   * field blank). Single-use: shown once in the UI, never stored.
   */
  generatedPassword?: string;
};
