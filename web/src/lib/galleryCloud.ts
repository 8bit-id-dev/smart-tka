import { insforge } from './insforge';

export const GALLERY_BUCKET = 'gallery';

export type GalleryFileType = 'image' | 'video' | 'document' | 'other';

export function typeOf(mime: string, name: string): GalleryFileType {
  const m = (mime || '').toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/.test(n)) return 'image';
  if (m.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|3gp)$/.test(n)) return 'video';
  if (m.includes('pdf') || m.includes('msword') || m.includes('spreadsheet') || m.includes('presentation') || /\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/.test(n)) return 'document';
  return 'other';
}

export type GalleryPhoto = {
  key: string;
  name: string;
  device: string;
  size: number;
  uploadedAt: string | null;
  mimeType: string;
  type: GalleryFileType;
};

/** List semua foto gambar dari bucket gallery, dengan pagination offset. */
export async function listGalleryPhotos(
  opts?: { prefix?: string },
): Promise<{ photos: GalleryPhoto[]; error: string | null }> {
  const limit = 500;
  let offset = 0;
  let total: number | null = null;
  let hasMore = true;
  const photos: GalleryPhoto[] = [];

  try {
    while (hasMore) {
      const { data, error } = await insforge.storage.from(GALLERY_BUCKET).list({
        prefix: opts?.prefix || undefined,
        limit,
        offset,
      });
      if (error) return { photos: [], error: error.message };
      const objects = (data?.objects ?? []) as {
        key: string;
        bucket: string;
        size: number;
        mimeType?: string;
        uploadedAt: string;
        url: string;
      }[];
      for (const o of objects) {
        const name = o.key.split('/').pop() || o.key;
        const mime = o.mimeType || '';
        photos.push({
          key: o.key,
          name,
          device: o.key.includes('/') ? o.key.split('/')[0] : 'unknown',
          size: o.size || 0,
          uploadedAt: o.uploadedAt || null,
          mimeType: mime || '',
          type: typeOf(mime, name),
        });
      }
      const pageTotal = data?.pagination?.total;
      if (typeof pageTotal === 'number') total = pageTotal;
      offset += objects.length;
      hasMore = objects.length > 0 && (total === null || offset < total);
    }

    return { photos, error: null };
  } catch (e) {
    return { photos: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// Cache signed URL: key -> { url, expiresAt } (refresh 55 menit, signed 1 jam)
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL = 55 * 60 * 1000;

/** Dapatkan signed URL untuk satu atau lebih key. Cache dipakai lintas panggilan. */
export async function getPhotoUrls(
  keys: string[],
): Promise<{ urls: Map<string, string>; error: string | null }> {
  const now = Date.now();
  const missing: string[] = [];
  const urls = new Map<string, string>();
  for (const k of keys) {
    const hit = urlCache.get(k);
    if (hit && hit.expiresAt > now) urls.set(k, hit.url);
    else missing.push(k);
  }
  if (missing.length === 0) return { urls, error: null };
  try {
    const { data, error } = await insforge.storage.from(GALLERY_BUCKET).createSignedUrls(missing, 3600);
    if (error) return { urls, error: error.message };
    for (const item of data ?? []) {
      if (item.signedUrl) {
        urls.set(item.path, item.signedUrl);
        urlCache.set(item.path, { url: item.signedUrl, expiresAt: now + CACHE_TTL });
      }
    }
    return { urls, error: null };
  } catch (e) {
    return { urls: new Map(), error: e instanceof Error ? e.message : String(e) };
  }
}