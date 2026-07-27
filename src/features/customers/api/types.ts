export type Customer = {
  id: string;
  customer_code: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  id_card_number: string;
  id_card_photo: string;
  service_data: string;
  billing_address: string;
  notes: string;
  status: string;
  created_by: string;
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
