import { describe, expect, it, vi } from 'vitest';
import { uploadSelfie } from './upload-client';

vi.mock('@/features/storage/api/service', () => ({
  getUploadUrlFn: vi.fn(async ({ data }) => ({
    url: 'https://presigned/put',
    key: `attendance/u/${Date.now()}.jpg`
  }))
}));

describe('uploadSelfie', () => {
  it('requests a presigned url and returns the object key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 }))
    );
    const key = await uploadSelfie('data:image/jpeg;base64,xx', 'attendance');
    expect(key).toMatch(/^attendance\/u\/\d+\.jpg$/);
    expect(fetch).toHaveBeenCalledWith(
      'https://presigned/put',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('throws when the upload PUT fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 }))
    );
    await expect(uploadSelfie('data:image/jpeg;base64,xx', 'attendance')).rejects.toThrow();
  });
});
