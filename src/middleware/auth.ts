// =============================================================================
// soko-api/src/middleware/auth.ts
// Dual Authentication Guard: Supports User JWTs & Master Organization API Keys.
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
    typeof c.orgId  === 'string' &&
    typeof c.role   === 'string'
  );
}

export const verifyToken: RequestHandler = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Missing or malformed Authorization header', 401);
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (token.length === 0) {
      throw new AppError('Missing access token', 401);
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
    // Method 2: Standard User/Service JWT
    // -------------------------------------------------------------------------
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new AppError('Invalid or expired access token', 401);
    }

    if (!isAppJwtPayload(decoded)) {
      throw new AppError('Invalid access token payload', 401);
    }

    const userWithOrg = await findUserById(decoded.userId);

    if (!userWithOrg) {
      throw new AppError('User account no longer exists', 401);
    }

    if (userWithOrg.org_id !== decoded.orgId) {
      throw new AppError('Token organization mismatch. Please log in again.', 403);
    }

    req.user  = userWithOrg;
    req.orgId = userWithOrg.org_id;
    req.role  = userWithOrg.role;

    next();
  } catch (err) {
    next(err);
  }
};