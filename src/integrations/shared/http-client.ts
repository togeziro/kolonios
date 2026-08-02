export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders
    };
  }

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers: { ...this.defaultHeaders, ...headers }
    });
  }

  async post<T>(endpoint: string, data: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: { ...this.defaultHeaders, ...headers },
      body: JSON.stringify(data)
    });
  }

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new HttpError('Network error: Unable to connect', 0, error.message);
      }
      throw new HttpError(
        'Request failed',
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
