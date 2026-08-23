import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT:                        z.coerce.number().default(3000),
  NODE_ENV:                    z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL:                z.string().url(),
  JWT_SECRET:                  z.string().min(8),
  JWT_EXPIRES_IN:              z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS:  z.coerce.number().default(30),
  DARAJA_CONSUMER_KEY:         z.string().min(1),
  DARAJA_CONSUMER_SECRET:      z.string().min(1),
  DARAJA_BASE_URL:             z.string().url().default('https://sandbox.safaricom.co.ke'),
  DARAJA_SHORTCODE:            z.string().min(1),
  DARAJA_PASSKEY:              z.string().min(1),
  ADMIN_SECRET:                z.string().min(16, 'ADMIN_SECRET must be at least 16 characters'),
  FRONTEND_URL:                z.string().url().optional().default('http://localhost:5173'),
  API_PUBLIC_URL:              z.string().url().optional().default('http://localhost:3000'),
  MPESA_CREDENTIALS_KEY:       z.string().min(16, 'MPESA_CREDENTIALS_KEY must be at least 16 characters').default('kauntaos-super-secret-mpesa-encryption-key-32bytes'),
  CLOUDINARY_CLOUD_NAME:       z.string().min(1),
  CLOUDINARY_API_KEY:          z.string().min(1),
  CLOUDINARY_API_SECRET:       z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables detected on startup:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;