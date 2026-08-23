import type { Customer as DBCustomer } from '@/lib/db/schema/customers';

// API response type (dates serialized to ISO strings)
export type Customer = Omit<DBCustomer, 'created_at' | 'updated_at'> & {
  created_at: string;
  updated_at: string;
};

export type CustomerFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
};

export type CustomersResponse = {
  success: boolean;
  time: string;
  message: string;
  total_customers: number;
  offset: number;
  limit: number;
  customers: Customer[];
};

export type CustomerByIdResponse = {
  success: boolean;
  time: string;
  message: string;
  customer: Customer;
};

export type CustomerMutationPayload = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  id_card_number?: string;
  id_card_photo?: string;
  service_data?: string;
  billing_address?: string;
  notes?: string;
  status?: string;
};
