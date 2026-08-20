// =============================================================================
// src/modules/transactions/transactions.routes.ts
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
  ledgerHandler,
  recordHandler,
  smartSaleHandler,
  settleDebtHandler,
} from './transactions.controller';

const router = Router();

router.use(verifyToken);

router.post('/smart-sale',       smartSaleHandler);
router.post('/settle-debt',      settleDebtHandler);
router.post('/',                 recordHandler);
router.get('/:customerId',       ledgerHandler);

export default router;