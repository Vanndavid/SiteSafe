export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const PRESIGNED_UPLOAD_EXPIRES_SECONDS = 5 * 60;

export const sanitizeFileName = (fileName: string) => {
  const baseName = fileName.split(/[\\/]/).pop() || 'document';
  const safeName = baseName
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 120);

  return safeName || 'document';
};

export const validateUploadIntent = (fileName: unknown, mimeType: unknown, sizeBytes: unknown) => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return 'fileName is required';
  }

  if (typeof mimeType !== 'string' || !ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    return 'Unsupported file type';
  }

  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return 'sizeBytes must be a positive number';
  }

  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return `File must be ${MAX_UPLOAD_SIZE_BYTES} bytes or smaller`;
  }

  return null;
};
