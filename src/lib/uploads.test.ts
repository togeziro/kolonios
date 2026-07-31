import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import { validateUpload } from './uploads';

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

function expectUploadInvalid(fn: () => void) {
  let error: unknown;
  try {
    fn();
  } catch (err) {
    error = err;
  }
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe('UPLOAD_INVALID');
}

describe('validateUpload', () => {
  it('accepts a valid file', () => {
    expect(() =>
      validateUpload({
        file: makeFile('doc.pdf', 'application/pdf', 1024),
        accept: ['application/pdf']
      })
    ).not.toThrow();
  });

  it('rejects a disallowed mime type', () => {
    expectUploadInvalid(() =>
      validateUpload({
        file: makeFile('virus.exe', 'application/x-msdownload', 1024),
        accept: ['application/pdf']
      })
    );
  });

  it('rejects an oversized file', () => {
    expectUploadInvalid(() =>
      validateUpload({
        file: makeFile('big.png', 'image/png', 5 * 1024 * 1024),
        maxSize: 1024 * 1024
      })
    );
  });
});
