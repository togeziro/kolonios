import { TripayClient } from './client';
import type { TripayTransactionRequest } from './types';

export class TripayService {
  private client: TripayClient;

  constructor() {
    this.client = new TripayClient();
  }

  async createPayment(
    request: Omit<TripayTransactionRequest, 'merchant_ref' | 'signature'>
  ): Promise<unknown> {
    // TODO: Implement payment creation logic
    return this.client.createTransaction(request);
  }

  async getPaymentStatus(reference: string): Promise<unknown> {
    // TODO: Implement status check logic
    return this.client.checkStatus(reference);
  }
}
