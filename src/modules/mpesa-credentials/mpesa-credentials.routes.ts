// =============================================================================
// src/modules/mpesa-credentials/mpesa-credentials.routes.ts
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
  getCredentialsHandler,
  saveCredentialsHandler,
  verifyCredentialsHandler,
  deleteCredentialsHandler,
} from './mpesa-credentials.controller';

const router = Router();

router.use(verifyToken);

router.get('/', getCredentialsHandler);
router.post('/', saveCredentialsHandler);
router.post('/verify', verifyCredentialsHandler);
router.delete('/', deleteCredentialsHandler);

export default router;