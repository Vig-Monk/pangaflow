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

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  fileUrl: string;
  expiresInSeconds: number;
}

function cleanAccountId(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\.r2\.cloudflarestorage\.com.*$/i, '')
    .replace(/\/+$/, '');
}

export function getR2Client(): S3Client {
  if (!s3ClientInstance) {
    const accountId = cleanAccountId(env.R2_ACCOUNT_ID);
    const accessKeyId = (env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (env.R2_SECRET_ACCESS_KEY || '').trim();
    const bucketName = (env.R2_BUCKET_NAME || '').trim();

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new AppError(
        'Cloudflare R2 is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.',
        503
      );
    }

    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
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
  const accountId = cleanAccountId(env.R2_ACCOUNT_ID);
  const bucketName = (env.R2_BUCKET_NAME || 'flemela-books').trim();

  const sanitized = rawFilename.toLowerCase().replace(/[^a-z0-9.-]/g, '_');
  const key = `ebooks/${orgId}/${Date.now()}-${sanitized}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const expiresInSeconds = 900;
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

  // Compute storage file reference URI
  const fileUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;

  return {
    uploadUrl,
    key,
    fileUrl,
    expiresInSeconds,
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
  const bucketName = (env.R2_BUCKET_NAME || 'flemela-books').trim();
  const safeFilename = downloadFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Streams a remote file directly into Cloudflare R2.
 */
export async function streamRemoteUrlToR2(
  remoteUrl: string,
  orgId: string,
  filename: string,
  contentType = 'application/pdf'
): Promise<{ key: string; fileSizeBytes: number }> {
  const client = getR2Client();
  const bucketName = (env.R2_BUCKET_NAME || 'flemela-books').trim();
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
      Bucket: bucketName,
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
 * Deletes an object from Cloudflare R2 bucket.
 */
export async function deleteR2Object(key: string): Promise<void> {
  const client = getR2Client();
  const bucketName = (env.R2_BUCKET_NAME || 'flemela-books').trim();
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
  } catch (err) {
    console.warn(`Failed to delete object from R2 (Key: ${key}):`, err);
  }
}