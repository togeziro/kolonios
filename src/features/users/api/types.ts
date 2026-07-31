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
};
