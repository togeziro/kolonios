// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';

const { infoMock } = vi.hoisted(() => ({ infoMock: vi.fn() }));

vi.mock('sonner', () => ({
  toast: {
    info: infoMock
  }
}));

import { stubAction } from './stub-action';

describe('stubAction', () => {
  beforeEach(() => {
    infoMock.mockClear();
  });

  it('fires a localized informational toast', () => {
    stubAction();
    expect(infoMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith('Coming soon');
  });

  it('performs no navigation or request by construction (void return, no router deps)', () => {
    const result = stubAction();
    expect(result).toBeUndefined();
    expect(stubAction.length).toBeLessThanOrEqual(1);
    expect(infoMock).toHaveBeenCalledTimes(1);
  });
});
