// =============================================================================
// src/middleware/validate.ts
// Generic Zod-based request validation middleware factory.
// =============================================================================

import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/error';

/**
 * Returns an Express middleware that validates req.body against the given
 * Zod schema. On success, req.body is REPLACED with the parsed (and
 * type-coerced/defaulted) result — so downstream handlers receive the
 * validated shape, not the raw input. On failure, throws AppError(400)
 * with the first validation issue's message, caught by the global
 * errorHandler via next().
 *
 * Usage:
 *   router.post('/stk', validateBody(StkPushBodySchema), stkPushHandler);
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