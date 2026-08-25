// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';

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

  it('takes no router or request dependencies — only the sonner toast fires', () => {
    stubAction();
    stubAction('Reject');
    expect(infoMock).toHaveBeenCalledTimes(2);
    expect(infoMock).toHaveBeenNthCalledWith(1, 'Coming soon');
    expect(infoMock).toHaveBeenNthCalledWith(2, 'Reject — Coming soon');
  });
});
