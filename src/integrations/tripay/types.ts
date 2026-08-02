export interface TripayConfig {
  apiKey: string;
  merchantCode: string;
  isProduction: boolean;
}

export interface TripayTransactionRequest {
  method: string;
  merchant_ref: string;
  amount: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  order_items: TripayOrderItem[];
  callback_url: string;
  return_url: string;
  expired_time?: number;
  signature: string;
}

export interface TripayOrderItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  product_url?: string;
  image_url?: string;
}

export interface TripayTransactionResponse {
  success: boolean;
  message: string;
  data?: {
    reference: string;
    merchant_ref: string;
    payment_selection_type: string;
    payment_method: string;
    payment_name: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    callback_url: string;
    return_url: string;
    amount: number;
    fee_merchant: number;
    fee_customer: number;
    total_fee: number;
    amount_received: number;
    pay_code?: string;
    pay_url?: string;
    checkout_url?: string;
    status: TripayTransactionStatus;
    expired_time: number;
    order_items: TripayOrderItem[];
    instructions?: TripayInstruction[];
  };
  errors?: Record<string, string[]>;
}

export interface TripayInstruction {
  code: string;
  name: string;
  steps: string[];
}

export enum TripayTransactionStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  REFUND = 'REFUND'
}

export interface TripayStatusResponse {
  success: boolean;
  message: string;
  data?: {
    reference: string;
    merchant_ref: string;
    payment_method: string;
    payment_name: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    amount: number;
    fee_merchant: number;
    fee_customer: number;
    total_fee: number;
    amount_received: number;
    status: TripayTransactionStatus;
    paid_time?: number;
    expired_time: number;
    order_items: TripayOrderItem[];
  };
}

export interface TripayWebhookPayload {
  reference: string;
  merchant_ref: string;
  payment_method: string;
  payment_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount: number;
  fee_merchant: number;
  fee_customer: number;
  total_fee: number;
  amount_received: number;
  status: TripayTransactionStatus;
  paid_time?: number;
  note?: string;
}
