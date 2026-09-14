export type User = {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  role_group_id: string | null;
  role_group_name: string | null;
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
