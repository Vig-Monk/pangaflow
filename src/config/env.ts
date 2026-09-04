// =============================================================================
// soko-api/src/config/env.ts
// Validated Environment Variables with SMTP Configuration
// =============================================================================

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT:                        z.coerce.number().default(3000),
  NODE_ENV:                    z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL:                z.string().url(),
  REDIS_URL:                   z.string().optional().default('redis://127.0.0.1:6379'),
  JWT_SECRET:                  z.string().min(8),
  JWT_EXPIRES_IN:              z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS:  z.coerce.number().default(30),
  DARAJA_CONSUMER_KEY:         z.string().min(1),
  DARAJA_CONSUMER_SECRET:      z.string().min(1),
  DARAJA_BASE_URL:             z.string().url().default('https://sandbox.safaricom.co.ke'),
  DARAJA_SHORTCODE:            z.string().min(1),
  DARAJA_PASSKEY:              z.string().min(1),
  ADMIN_SECRET:                z.string().min(16, 'ADMIN_SECRET must be at least 16 characters'),
  FRONTEND_URL:                z.string().url().optional().default('http://localhost:3333'),
  API_PUBLIC_URL:              z.string().url().optional().default('http://localhost:3000'),
  MPESA_CREDENTIALS_KEY:       z.string().min(32, 'MPESA_CREDENTIALS_KEY must be at least 32 characters for AES-256-GCM'),
  CLOUDINARY_CLOUD_NAME:       z.string().min(1),
  CLOUDINARY_API_KEY:          z.string().min(1),
  CLOUDINARY_API_SECRET:       z.string().min(1),
  R2_ACCOUNT_ID:               z.string().optional().default(''),
  R2_ACCESS_KEY_ID:           z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY:       z.string().optional().default(''),
  R2_BUCKET_NAME:              z.string().optional().default('flemela-books'),

  // Transactional SMTP Settings (Nodemailer)
  SMTP_HOST:                   z.string().optional().default(''),
  SMTP_PORT:                   z.coerce.number().default(465),
  SMTP_SECURE:                 z.coerce.boolean().default(true),
  SMTP_USER:                   z.string().optional().default(''),
  SMTP_PASS:                   z.string().optional().default(''),
  SMTP_FROM:                   z.string().default('Flemela Bookstore <orders@flemela.co.ke>'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables detected on startup:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;