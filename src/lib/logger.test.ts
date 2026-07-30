import { describe, it, expect } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  it('exports a logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });
});
