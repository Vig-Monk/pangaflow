// =============================================================================
// soko-api/src/modules/auth/auth.routes.ts
// Route wiring for auth with scoped rate limiting.
// =============================================================================

import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimiter';
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerHandler,
} from './auth.controller';

const router = Router();

router.post('/register', authLimiter, registerHandler);
router.post('/login', authLimiter, loginHandler);
router.post('/refresh', authLimiter, refreshHandler);
router.post('/logout', logoutHandler);

export default router;