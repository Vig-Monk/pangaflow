// =============================================================================
// src/modules/transactions/dashboard.routes.ts
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import { dashboardSummaryHandler } from './transactions.controller';
import { fullDashboardHandler } from '../expenses/expenses.controller';

const router = Router();

router.use(verifyToken);

router.get('/summary', dashboardSummaryHandler);
router.get('/full', fullDashboardHandler);

export default router;