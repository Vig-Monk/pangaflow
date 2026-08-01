// src/middleware/auth.ts
import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/error';
import { findUserById } from '../modules/auth/auth.queries';
import { JwtPayload } from '../modules/auth/auth.service';

// ---------------------------------------------------------------------------
// Runtime type guard — narrows jwt.verify() result to our JwtPayload shape
// ---------------------------------------------------------------------------

function isAppJwtPayload(decoded: unknown): decoded is JwtPayload {
  if (typeof decoded !== 'object' || decoded === null) return false;
  const c = decoded as Record<string, unknown>;
  return (
    typeof c.userId === 'string' &&
    typeof c.orgId  === 'string' &&
    typeof c.role   === 'string'
  );
}

// ---------------------------------------------------------------------------
// verifyToken
// Attaches req.user, req.orgId, req.role via the existing express.d.ts
// augmentation. Throws AppError — caught by the global errorHandler.
// ---------------------------------------------------------------------------

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