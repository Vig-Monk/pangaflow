// =============================================================================
// soko-api/src/services/r2.service.ts
// Cloudflare R2 Private S3-Compatible Object Storage Service
// Generates presigned upload URLs (PUT) and expiring download URLs (GET).
// =============================================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import axios from 'axios';
import { Readable } from 'stream';
import { env } from '../config/env';
import { AppError } from '../utils/error';

let s3ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!s3ClientInstance) {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      throw new AppError('Cloudflare R2 credentials are not configured in environment', 500);
    }

    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
}

/**
 * Generates a presigned PUT URL for direct browser-to-Cloudflare-R2 upload (15-min TTL).
 */
export async function generatePresignedUploadUrl(
  orgId: string,
  rawFilename: string,
  contentType = 'application/pdf'
): Promise<PresignedUploadResult> {
  const client = getR2Client();
  const sanitized = rawFilename.toLowerCase().replace(/[^a-z0-9.-]/g, '_');
  const key = `ebooks/${orgId}/${Date.now()}-${sanitized}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

  return {
    uploadUrl,
    key,
  };
}

/**
 * Generates an expiring presigned GET URL for authorized tokenized book downloads (1-hour TTL).
 */
export async function generatePresignedDownloadUrl(
  fileKey: string,
  downloadFilename: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = getR2Client();
  const safeFilename = downloadFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Streams a remote file (e.g. Google Drive direct link) directly into Cloudflare R2.
 */
export async function streamRemoteUrlToR2(
  remoteUrl: string,
  orgId: string,
  filename: string,
  contentType = 'application/pdf'
): Promise<{ key: string; fileSizeBytes: number }> {
  const client = getR2Client();
  const sanitized = filename.toLowerCase().replace(/[^a-z0-9.-]/g, '_');
  const key = `ebooks/${orgId}/${Date.now()}-${sanitized}`;

  const response = await axios.get<Readable>(remoteUrl, {
    responseType: 'stream',
    timeout: 60000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
  });

  let bytesCount = 0;
  response.data.on('data', (chunk: Buffer) => {
    bytesCount += chunk.length;
  });

  const upload = new Upload({
    client,
    params: {
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: response.data,
      ContentType: contentType,
    },
  });

  await upload.done();

  const rawLength = response.headers['content-length'];
  const parsedLength =
    typeof rawLength === 'number'
      ? rawLength
      : typeof rawLength === 'string'
        ? parseInt(rawLength, 10)
        : 0;

  return {
    key,
    fileSizeBytes: bytesCount || (isNaN(parsedLength) ? 0 : parsedLength),
  };
}

/**
 * Deletes a file from Cloudflare R2 bucket.
 */
export async function deleteR2Object(key: string): Promise<void> {
  const client = getR2Client();
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
      })
    );
  } catch (err) {
    console.warn(`Failed to delete object from R2 (Key: ${key}):`, err);
  }
}