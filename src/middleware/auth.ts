// =============================================================================
// soko-api/src/middleware/auth.ts
// Dual Authentication Guard: Case-Insensitive Bearer & Master Secret Support
// =============================================================================

import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/error';
import { findUserById } from '../modules/auth/auth.queries';
import { JwtPayload } from '../modules/auth/auth.service';
import { pool } from '../config/db';

function isAppJwtPayload(decoded: unknown): decoded is JwtPayload {
  if (typeof decoded !== 'object' || decoded === null) return false;
  const c = decoded as Record<string, unknown>;
  return (
    typeof c.userId === 'string' &&
    typeof c.orgId === 'string' &&
    typeof c.role === 'string'
  );
}

export const verifyToken: RequestHandler = async (req, _res, next) => {
  try {
    const rawHeader = req.headers.authorization;

    if (!rawHeader || typeof rawHeader !== 'string') {
      throw new AppError('Missing or malformed Authorization header', 401, true, {
        code: 'AUTH_HEADER_MISSING',
      });
    }

    const trimmedHeader = rawHeader.trim();
    // RFC 6750 compliant case-insensitive Bearer prefix match
    const match = trimmedHeader.match(/^Bearer\s+(.+)$/i);

    if (!match || !match[1]) {
      throw new AppError('Missing or malformed Authorization header', 401, true, {
        code: 'AUTH_HEADER_MALFORMED',
      });
    }

    const token = match[1].trim();

    // Guard against stringified empty states
    if (!token || token === 'undefined' || token === 'null' || token === '[object Object]') {
      throw new AppError('Missing access token', 401, true, {
        code: 'AUTH_TOKEN_EMPTY',
      });
    }

    // -------------------------------------------------------------------------
    // Method 1: Permanent Master Org API Key or Admin Secret
    // -------------------------------------------------------------------------
    if (token === env.ADMIN_SECRET) {
      const orgRes = await pool.query<{ id: string }>(
        `SELECT id FROM organizations WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`
      );
      if (orgRes.rows[0]) {
        req.orgId = orgRes.rows[0].id;
        req.role = 'owner';
        return next();
      }
    }

    // -------------------------------------------------------------------------
    // Method 2: Standard User/Service JWT Verification
    // -------------------------------------------------------------------------
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (jwtErr: any) {
      const isExpired = jwtErr?.name === 'TokenExpiredError';
      throw new AppError(
        isExpired ? 'Access token has expired' : 'Invalid or expired access token',
        401,
        true,
        { code: isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID' }
      );
    }

    if (!isAppJwtPayload(decoded)) {
      throw new AppError('Invalid access token payload structure', 401, true, {
        code: 'AUTH_PAYLOAD_INVALID',
      });
    }

    const userWithOrg = await findUserById(decoded.userId);

    if (!userWithOrg) {
      throw new AppError('User account no longer exists', 401, true, {
        code: 'AUTH_USER_NOT_FOUND',
      });
    }

    if (userWithOrg.org_id !== decoded.orgId) {
      throw new AppError('Token organization mismatch. Please log in again.', 403, true, {
        code: 'AUTH_ORG_MISMATCH',
      });
    }

    req.user = userWithOrg;
    req.orgId = userWithOrg.org_id;
    req.role = userWithOrg.role;

    next();
  } catch (err) {
    next(err);
  }
};