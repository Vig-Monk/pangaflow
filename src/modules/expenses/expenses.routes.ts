// =============================================================================
// src/modules/expenses/expenses.routes.ts
// Route wiring for the expenses module.
// Mounted at /api/v1/expenses in app.ts. All routes protected by verifyToken.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
	categoriesHandler,
  createHandler,
  listHandler,
  profitLossHandler,
  summaryHandler,
} from './expenses.controller';

const router = Router();

router.use(verifyToken);

// CRITICAL: /summary and /profit-loss must be registered before /:id
// would be, for the same reason /search precedes /:id in
// customers.routes.ts — Express matches routes in registration order.
// This module has no GET /:id route today, but the ordering convention
// is kept consistent in case one is added later (e.g. GET /expenses/:id
// for a single-expense detail view).
router.get('/categories', categoriesHandler);
router.get('/summary', summaryHandler);
router.get('/profit-loss', profitLossHandler);

router.get('/', listHandler);
router.post('/', createHandler);

export default router;