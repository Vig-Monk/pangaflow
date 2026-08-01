// =============================================================================
// src/modules/payments/payments.routes.ts
// Route wiring for payments. Mounted at /api/v1/payments in app.ts.
//
// CRITICAL: verifyToken is applied ONLY to /mpesa/stk, NOT to
// /mpesa/callback. The callback route is a public Safaricom webhook —
// Safaricom does not send a Bearer token, and applying verifyToken to
// this route would make every real callback 401 and fail permanently.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { callbackHandler, StkPushBodySchema, stkPushHandler } from './payments.controller';

const router = Router();

// POST /api/v1/payments/mpesa/stk — authenticated
router.post('/mpesa/stk', verifyToken, validateBody(StkPushBodySchema), stkPushHandler);

// POST /api/v1/payments/mpesa/callback — PUBLIC, no verifyToken
router.post('/mpesa/callback', callbackHandler);

export default router;