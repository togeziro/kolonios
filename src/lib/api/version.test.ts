import { describe, it, expect } from 'vitest';
import { API_PREFIX, API_VERSION } from './version';

describe('API version', () => {
  it('exports v1 prefix', () => {
    expect(API_VERSION).toBe('v1');
    expect(API_PREFIX).toBe('/api/v1');
  });
});
