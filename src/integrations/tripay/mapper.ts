import type { TripayTransactionRequest, TripayWebhookPayload } from './types';

export function mapToTripayTransaction(_data: unknown): Partial<TripayTransactionRequest> {
  // TODO: Implement mapping logic
  return {};
}

export function mapFromTripayWebhook(_payload: TripayWebhookPayload): unknown {
  // TODO: Implement webhook mapping logic
  return {};
}
