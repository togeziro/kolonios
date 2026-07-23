export type Product = {
  id: number;
  photo_url: string | null;
  name: string;
  description: string;
  price: number;
  category: string;
  created_at: string;
  updated_at: string;
};

export type ProductFilters = {
  page?: number;
  limit?: number;
  categories?: string | string[];
  search?: string;
  sort?: string;
};

export type ProductsResponse = {
  success: boolean;
  time: string;
  message: string;
  total_products: number;
  offset: number;
  limit: number;
  products: Product[];
};

export type ProductByIdResponse = {
  success: boolean;
  time: string;
  message: string;
  product: Product;
};

export type ProductMutationPayload = {
  name: string;
  category: string;
  price: number;
  description: string;
};
