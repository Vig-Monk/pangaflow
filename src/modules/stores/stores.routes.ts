// =============================================================================
// src/modules/stores/stores.routes.ts
// Routes — Store Settings.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import { getStoreSettingsHandler, saveStoreSettingsHandler } from './stores.controller';

const router = Router();

router.use(verifyToken);

router.get('/', getStoreSettingsHandler);
router.patch('/', saveStoreSettingsHandler);

export default router;