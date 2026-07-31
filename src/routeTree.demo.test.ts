import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeTreeSource = readFileSync(join(process.cwd(), 'src', 'routeTree.gen.ts'), 'utf8');

describe('routeTree.gen', () => {
  it('has no demo/showcase routes', () => {
    expect(routeTreeSource).not.toMatch(/dashboard\/forms/);
    expect(routeTreeSource).not.toMatch(/dashboard\/react-query/);
    expect(routeTreeSource).not.toMatch(/dashboard\/elements/);
  });
});
