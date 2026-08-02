import type { MikrotikCredentials, MikrotikResponse } from './types';

export class MikrotikClient {
  private credentials: MikrotikCredentials;

  constructor(credentials: MikrotikCredentials) {
    this.credentials = credentials;
  }

  async connect(): Promise<void> {
    // TODO: Implement MikroTik API connection
  }

  async disconnect(): Promise<void> {
    // TODO: Implement disconnection logic
  }

  async addPPPoEUser(user: unknown): Promise<MikrotikResponse> {
    // TODO: Implement PPPoE user creation
    return { success: false };
  }

  async removePPPoEUser(username: string): Promise<MikrotikResponse> {
    // TODO: Implement PPPoE user removal
    return { success: false };
  }

  async getActiveSessions(): Promise<MikrotikResponse> {
    // TODO: Implement active session retrieval
    return { success: false };
  }
}
