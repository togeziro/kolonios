import { getUploadUrlFn } from '@/features/storage/api/service';

export async function uploadSelfie(dataUrl: string, folder: 'attendance'): Promise<string> {
  const { url, key } = await getUploadUrlFn({
    data: { folder, contentType: 'image/jpeg' }
  });
  const blob = await (await fetch(dataUrl)).blob();
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob
  });
  if (!res.ok) throw new Error('Photo upload failed');
  return key;
}
