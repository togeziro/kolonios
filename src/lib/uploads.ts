import { DomainError } from './errors';

export type UploadValidationInput = {
  file: File;
  accept?: string[];
  maxSize?: number;
  maxFiles?: number;
};

export function validateUpload({ file, accept, maxSize, maxFiles }: UploadValidationInput) {
  if (
    accept &&
    accept.length > 0 &&
    !accept.some(
      (t) => t === file.type || (t.endsWith('/*') && file.type.startsWith(t.slice(0, -1)))
    )
  ) {
    throw new DomainError(`File type ${file.type || 'unknown'} is not allowed`, 'UPLOAD_INVALID');
  }
  if (maxSize !== undefined && file.size > maxSize) {
    throw new DomainError('File exceeds the maximum allowed size', 'UPLOAD_INVALID');
  }
  if (maxFiles !== undefined && maxFiles < 1) {
    throw new DomainError('At least one file is required', 'UPLOAD_INVALID');
  }
}
