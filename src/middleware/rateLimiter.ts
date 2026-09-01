// =============================================================================
// soko-api/src/middleware/rateLimiter.ts
// Dedicated scoped rate limiters protecting sensitive auth & financial routes.
// =============================================================================

import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for login and registration endpoints.
 * Allows maximum 10 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
      code: 'AUTH_RATE_LIMITED',
    },
  },
});