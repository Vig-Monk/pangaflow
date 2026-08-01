// =============================================================================
// src/verticals/market/agent.routes.ts
// Route wiring for the agent errand vertical.
// Mounted at /api/v1/agent in app.ts. All routes protected by verifyToken.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
  createClientHandler,
  createOrderHandler,
  dashboardHandler,
  listClientsHandler,
  todayOrdersHandler,
  updateOrderStatusHandler,
} from './agent.controller';

const router = Router();

router.use(verifyToken);

router.post('/clients', createClientHandler);
router.get('/clients', listClientsHandler);
router.post('/orders', createOrderHandler);
router.get('/orders/today', todayOrdersHandler);
router.patch('/orders/:id/status', updateOrderStatusHandler);
router.get('/dashboard', dashboardHandler);

export default router;