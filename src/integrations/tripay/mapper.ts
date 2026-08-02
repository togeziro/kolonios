import type { TripayTransactionRequest, TripayWebhookPayload } from './types';

export function mapToTripayTransaction(data: unknown): Partial<TripayTransactionRequest> {
  // TODO: Implement mapping logic
  return {};
}

export function mapFromTripayWebhook(payload: TripayWebhookPayload): unknown {
  // TODO: Implement webhook mapping logic
  return {};
}
