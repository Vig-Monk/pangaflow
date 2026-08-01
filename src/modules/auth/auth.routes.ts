// =============================================================================
// src/modules/auth/auth.routes.ts
// Route wiring for the auth module. Mounted at /api/v1/auth in app.ts.
// =============================================================================

import { Router } from 'express';
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerHandler,
} from './auth.controller';

const router = Router();

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);

export default router;