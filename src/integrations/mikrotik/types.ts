export interface MikrotikCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
}

export interface MikrotikPPPoEUser {
  name: string;
  password: string;
  profile: string;
  service: 'pppoe';
  disabled?: boolean;
  comment?: string;
  remoteAddress?: string;
  callerId?: string;
}

export interface MikrotikResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MikrotikUserProfile {
  name: string;
  localAddress?: string;
  remoteAddress?: string;
  rateLimit?: string;
  sessionTimeout?: number;
  idleTimeout?: number;
  keepaliveTimeout?: number;
}

export interface MikrotikActiveSession {
  name: string;
  user: string;
  service: string;
  callerId: string;
  address: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
}
