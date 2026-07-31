import { describe, it, expect } from 'vitest';
import { operations, openApiInfo } from './openapi';

describe('openapi operations registry', () => {
  it('exposes at least one operation per feature area', () => {
    const paths = new Set(operations.map((op) => op.path));
    expect(paths.size).toBeGreaterThan(30);
  });

  it('has unique operation ids and method+path pairs', () => {
    const ids = operations.map((op) => op.operationId);
    const routes = operations.map((op) => `${op.method.toUpperCase()} ${op.path}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('uses only supported HTTP methods and valid paths', () => {
    for (const op of operations) {
      expect(['get', 'post']).toContain(op.method);
      expect(op.path).toMatch(/^\//);
      expect(op.path).not.toMatch(/\s/);
    }
  });

  it('gives every operation a summary, permission and response description', () => {
    for (const op of operations) {
      expect(op.summary.length).toBeGreaterThan(0);
      expect(op.permission).toMatch(/^[a-z_]+\.[a-z]+$/);
      expect(op.responseDescription.length).toBeGreaterThan(0);
    }
  });

  it('matches path placeholders to pathParams keys', () => {
    for (const op of operations) {
      const placeholders = [...op.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      const paramKeys = Object.keys(op.pathParams ?? {});
      expect(paramKeys.toSorted()).toEqual(placeholders.toSorted());
    }
  });

  it('never declares a body schema on GET operations', () => {
    for (const op of operations) {
      if (op.method === 'get') expect(op.body).toBeUndefined();
    }
  });

  it('exposes API metadata', () => {
    expect(openApiInfo.title).toBe('Kolonios API');
    expect(openApiInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(openApiInfo.license).toEqual({ name: 'MIT' });
  });
});
