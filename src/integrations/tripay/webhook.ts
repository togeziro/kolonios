import type { TripayWebhookPayload } from './types';

export function verifyTripayWebhook(_payload: TripayWebhookPayload, _signature: string): boolean {
  // TODO: Implement webhook verification
  return false;
}

export function handleTripayWebhook(_payload: TripayWebhookPayload): Promise<unknown> {
  // TODO: Implement webhook handling logic
  return Promise.resolve({});
}
