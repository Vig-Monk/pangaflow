// =============================================================================
// src/utils/crypto.ts
// Secure AES-256-GCM authenticated encryption/decryption for credentials.
// =============================================================================

import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Derives a strict 32-byte (256-bit) buffer key from the environment secret.
 * Handles base64, hex, or arbitrary string encodings safely.
 */
function getMasterKey(): Buffer {
  const raw = env.MPESA_CREDENTIALS_KEY;

  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  if (raw.length === 44 && /^[A-Za-z0-9+/=]+$/.test(raw)) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  }

  // Cryptographic digest ensures guaranteed 32-byte key
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a plaintext secret with AES-256-GCM.
 * Output format: `ivHex:authTagHex:ciphertextHex`
 */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a formatted ciphertext string with authentication tag verification.
 * Throws an error if the key is wrong or if the payload was modified.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted ciphertext payload');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}