import { HttpClient } from '../shared/http-client';
import type {
  TripayTransactionRequest,
  TripayTransactionResponse,
  TripayStatusResponse
} from './types';

export class TripayClient {
  private httpClient: HttpClient;
  private merchantCode: string;
  private apiKey: string;

  constructor() {
    const apiKey = process.env.TRIPAY_API_KEY;
    const merchantCode = process.env.TRIPAY_MERCHANT_CODE;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!apiKey || !merchantCode) {
      throw new Error(
        'Tripay configuration missing: TRIPAY_API_KEY and TRIPAY_MERCHANT_CODE must be set'
      );
    }

    this.apiKey = apiKey;
    this.merchantCode = merchantCode;

    const baseUrl = isProduction ? 'https://tripay.co.id/api' : 'https://tripay.co.id/api-sandbox';

    this.httpClient = new HttpClient(baseUrl, {
      Authorization: `Bearer ${apiKey}`
    });
  }

  async createTransaction(
    request: Omit<TripayTransactionRequest, 'merchant_ref' | 'signature'>
  ): Promise<TripayTransactionResponse> {
    const merchant_ref = `INV-${Date.now()}`;
    const signature = this.generateSignature(request.amount, merchant_ref);

    const transactionRequest: TripayTransactionRequest = {
      ...request,
      merchant_ref,
      signature
    };

    return this.httpClient.post<TripayTransactionResponse>(
      '/transaction/create',
      transactionRequest
    );
  }

  async checkStatus(reference: string): Promise<TripayStatusResponse> {
    return this.httpClient.get<TripayStatusResponse>(`/transaction/detail?reference=${reference}`);
  }

  private generateSignature(amount: number, merchantRef: string): string {
    const data = `${this.merchantCode}${merchantRef}${amount}`;
    return require('crypto').createHmac('sha256', this.apiKey).update(data).digest('hex');
  }
}
