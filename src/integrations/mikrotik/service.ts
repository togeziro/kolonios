import { MikrotikClient } from './client';
import type { MikrotikCredentials, MikrotikPPPoEUser } from './types';

export class MikrotikService {
  private client: MikrotikClient;

  constructor(credentials: MikrotikCredentials) {
    this.client = new MikrotikClient(credentials);
  }

  async provisionUser(user: MikrotikPPPoEUser): Promise<unknown> {
    // TODO: Implement user provisioning logic
    return this.client.addPPPoEUser(user);
  }

  async deprovisionUser(username: string): Promise<unknown> {
    // TODO: Implement user deprovisioning logic
    return this.client.removePPPoEUser(username);
  }

  async checkUserStatus(username: string): Promise<unknown> {
    // TODO: Implement user status check
    return {};
  }
}
