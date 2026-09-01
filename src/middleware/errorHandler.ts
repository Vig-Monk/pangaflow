// =============================================================================
// soko-api/src/middleware/errorHandler.ts
// Global Express error handler utilizing validated env configuration.
// =============================================================================

import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error';
import { error as sendErrorResponse } from '../utils/response';
import { env } from '../config/env';
import pino from 'pino';

const logger = pino();

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const reqId = req.requestId || 'unknown';

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, reqId }, 'Operational internal server error');
    } else {
      logger.warn({ err, reqId }, 'Operational client-side warning');
    }
    sendErrorResponse(res, err.statusCode, err.message, err.details);
    return;
  }

  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
      },
      reqId,
    },
    'Unhandled fatal exception'
  );

  const isProduction = env.NODE_ENV === 'production';
  const message = isProduction
    ? 'An unexpected error occurred. Please try again later.'
    : err.message;

  sendErrorResponse(
    res,
    500,
    message,
    isProduction ? undefined : { stack: err.stack }
  );
};