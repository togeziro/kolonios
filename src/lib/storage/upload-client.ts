import { getUploadUrlFn } from './upload-fns';

export const PHOTO_UPLOAD_FAILED = 'PHOTO_UPLOAD_FAILED';

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
  if (!res.ok) throw new Error(PHOTO_UPLOAD_FAILED);
  return key;
}

export async function uploadTicketPhoto(dataUrl: string, photoId: number): Promise<string> {
  const { url, key } = await getUploadUrlFn({
    data: { folder: 'tickets', ownerId: String(photoId), contentType: 'image/jpeg' }
  });
  const blob = await (await fetch(dataUrl)).blob();
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob
  });
  if (!res.ok) throw new Error(PHOTO_UPLOAD_FAILED);
  return key;
}

export async function uploadChecklistPhoto(dataUrl: string, itemId: number): Promise<string> {
  const { url, key } = await getUploadUrlFn({
    data: { folder: 'checklists', ownerId: String(itemId), contentType: 'image/jpeg' }
  });
  const blob = await (await fetch(dataUrl)).blob();
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob
  });
  if (!res.ok) throw new Error(PHOTO_UPLOAD_FAILED);
  return key;
}
