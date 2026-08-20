// =============================================================================
// src/modules/analytics/analytics.routes.ts
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import { getAnalyticsOverviewHandler } from './analytics.controller';

const router = Router();

router.use(verifyToken);

router.get('/overview', getAnalyticsOverviewHandler);

export default router;