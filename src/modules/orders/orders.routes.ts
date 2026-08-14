// =============================================================================
// src/modules/orders/orders.routes.ts
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
  listOrdersHandler,
  getOrderHandler,
  getOrdersSummaryHandler,
  updateOrderStatusHandler,
} from './orders.controller';

const router = Router();

router.use(verifyToken);

// Mount /summary before /:id to prevent UUID casting errors on string 'summary'
router.get('/summary', getOrdersSummaryHandler);
router.get('/', listOrdersHandler);
router.get('/:id', getOrderHandler);
router.patch('/:id/status', updateOrderStatusHandler);

export default router;