// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './error-boundary';

vi.mock('@/lib/sentry', () => ({
  captureError: vi.fn()
}));

import { captureError } from '@/lib/sentry';

const mockedCapture = vi.mocked(captureError);

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => mockedCapture.mockClear());

  it('renders the fallback and reports the error to Sentry', () => {
    render(
      <ErrorBoundary fallback={<p>fallback-ui</p>}>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('fallback-ui')).toBeTruthy();
    expect(mockedCapture).toHaveBeenCalledTimes(1);
    expect(mockedCapture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<p>fallback-ui</p>}>
        <p>child-ui</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('child-ui')).toBeTruthy();
    expect(mockedCapture).not.toHaveBeenCalled();
  });
});
