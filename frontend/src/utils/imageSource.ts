/**
 * Shared helpers for reasoning about a picked/captured image source before upload.
 * Extracted from ReviewMealScreen so the background scan manager can reuse them.
 */
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);

export const normalizeMimeType = (value?: string | null): string =>
  (value || '').split(';')[0].trim().toLowerCase();

export const looksLikeHeicPath = (value?: string | null): boolean => {
  const normalized = (value || '').split('?')[0].split('#')[0].toLowerCase();
  return normalized.endsWith('.heic') || normalized.endsWith('.heif');
};

/** HEIC/HEIF is unstable in client-side transcode paths — callers skip compression for these. */
export const isHeicLikeSource = (mimeType?: string | null, path?: string | null): boolean =>
  HEIC_MIME_TYPES.has(normalizeMimeType(mimeType)) || looksLikeHeicPath(path);
