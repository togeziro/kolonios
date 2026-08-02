export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export class TripayIntegrationError extends IntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'TRIPAY_ERROR', cause);
    this.name = 'TripayIntegrationError';
  }
}

export class MikrotikIntegrationError extends IntegrationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'MIKROTIK_ERROR', cause);
    this.name = 'MikrotikIntegrationError';
  }
}
