-- Add the pre-confirmation state used by direct browser-to-S3 uploads.
ALTER TYPE "DocumentStatus" ADD VALUE 'uploading';
