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
  updateOrderPaymentStatusHandler,
} from './orders.controller';

const router = Router();

router.use(verifyToken);

router.get('/summary', getOrdersSummaryHandler);
router.get('/', listOrdersHandler);
router.get('/:id', getOrderHandler);
router.patch('/:id/status', updateOrderStatusHandler);
router.patch('/:id/payment-status', updateOrderPaymentStatusHandler);

export default router;