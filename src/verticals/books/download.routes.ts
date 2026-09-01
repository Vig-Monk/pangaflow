// =============================================================================
// src/verticals/books/download.routes.ts
// Public tokenized download route with rate limiting to prevent token enumeration.
// =============================================================================

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { downloadBookHandler } from './download.controller';

const router = Router();

// Anti-enumeration shield: max 30 download attempts per 15 minutes per IP
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many download requests. Please try again later.',
    },
  },
});

// Public: GET /api/v1/books/download/:token
router.get('/:token', downloadLimiter, downloadBookHandler);

export default router;