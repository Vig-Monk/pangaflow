// =============================================================================
// soko-api/src/modules/smtp/smtp.routes.ts
// Route wiring for tenant SMTP settings. All routes protected by verifyToken.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
  getSmtpCredentialsHandler,
  saveSmtpCredentialsHandler,
  verifySmtpCredentialsHandler,
  deleteSmtpCredentialsHandler,
} from './smtp.controller';

const router = Router();

router.use(verifyToken);

router.get('/', getSmtpCredentialsHandler);
router.post('/', saveSmtpCredentialsHandler);
router.post('/verify', verifySmtpCredentialsHandler);
router.delete('/', deleteSmtpCredentialsHandler);

export default router;