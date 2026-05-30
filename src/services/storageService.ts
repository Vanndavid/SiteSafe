import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const getObjectHead = async (key: string) => {
  return s3.send(new HeadObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  }));
};

export const createSignedUploadUrl = async (
  key: string,
  mimeType: string,
  metadata: Record<string, string>,
  expiresInSeconds: number,
) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
    Metadata: metadata,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
};

export const generatePresignedDownloadUrl = async (fileKey: string) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileKey,
  });

  return getSignedUrl(s3, command, { expiresIn: 3600 });
};
