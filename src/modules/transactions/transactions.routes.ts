// =============================================================================
// src/modules/transactions/transactions.routes.ts
// Route wiring for the transactions module.
// Mounts at /api/v1/transactions in app.ts.
// All routes protected by verifyToken.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import { ledgerHandler, recordHandler } from './transactions.controller';

const router = Router();

router.use(verifyToken);

router.post('/',                 recordHandler);
router.get('/:customerId',       ledgerHandler);

export default router;