// =============================================================================
// src/modules/stores/stores.routes.ts
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
  getStoreSettingsHandler,
  saveStoreSettingsHandler,
  getMerchantLocationHandler,
  saveMerchantLocationHandler,
  getPromoTickerHandler,
  savePromoTickerHandler,
} from './stores.controller';

const router = Router();

router.use(verifyToken);

// Promotional Gold Ribbon Ticker Endpoints
router.get('/ticker', getPromoTickerHandler);
router.put('/ticker', savePromoTickerHandler);

// Location Hub Endpoints
router.get('/location', getMerchantLocationHandler);
router.patch('/location', saveMerchantLocationHandler);

// Store Settings Endpoints
router.get('/', getStoreSettingsHandler);
router.patch('/', saveStoreSettingsHandler);

export default router;