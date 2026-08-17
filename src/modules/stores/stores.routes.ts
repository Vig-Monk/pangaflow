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
} from './stores.controller';

const router = Router();

router.use(verifyToken);

// Location Hub Endpoints
router.get('/location', getMerchantLocationHandler);
router.patch('/location', saveMerchantLocationHandler);

// Store Settings Endpoints
router.get('/', getStoreSettingsHandler);
router.patch('/', saveStoreSettingsHandler);

export default router;