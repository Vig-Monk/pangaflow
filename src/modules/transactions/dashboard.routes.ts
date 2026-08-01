// =============================================================================
// src/modules/transactions/dashboard.routes.ts (UPDATED)
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import { dashboardSummaryHandler } from './transactions.controller';
import { fullDashboardHandler } from '../expenses/expenses.controller'; // ADD

const router = Router();

router.use(verifyToken);

router.get('/summary', dashboardSummaryHandler);
router.get('/full', fullDashboardHandler); // ADD

export default router;