import type { TripayWebhookPayload } from './types';

export function verifyTripayWebhook(payload: TripayWebhookPayload, signature: string): boolean {
  // TODO: Implement webhook verification
  return false;
}

export function handleTripayWebhook(payload: TripayWebhookPayload): Promise<unknown> {
  // TODO: Implement webhook handling logic
  return Promise.resolve({});
}
