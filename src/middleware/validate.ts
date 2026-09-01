// =============================================================================
// soko-api/src/middleware/validate.ts
// Generic Zod-based request validation middleware factories for body and query.
// =============================================================================

import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/error';

/**
 * Validates req.body against a Zod schema.
 */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const message = firstIssue?.message ?? 'Invalid request body';
      next(new AppError(message, 400));
      return;
    }

    req.body = parsed.data;
    next();
  };
}

/**
 * Validates req.query against a Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const message = firstIssue?.message ?? 'Invalid query parameters';
      next(new AppError(message, 400));
      return;
    }

    req.query = parsed.data as any;
    next();
  };
}