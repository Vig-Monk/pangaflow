// =============================================================================
// soko-api/src/modules/banners/banners.routes.ts
// Route wiring for promotional hero banners.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
  listPublicBannersHandler,
  trackBannerClickHandler,
  listAdminBannersHandler,
  createBannerHandler,
  updateBannerHandler,
  deleteBannerHandler,
  reorderBannersHandler,
} from './banners.controller';

const router = Router();

// -----------------------------------------------------------------------------
// 1. Public Storefront Endpoints (No Auth Required)
// -----------------------------------------------------------------------------
router.get('/public/:storeSlug', listPublicBannersHandler);
router.post('/:id/click', trackBannerClickHandler);

// -----------------------------------------------------------------------------
// 2. Admin Management Endpoints (Requires Valid Admin Bearer JWT)
// -----------------------------------------------------------------------------
router.use(verifyToken);

router.get('/', listAdminBannersHandler);
router.post('/', createBannerHandler);
router.post('/reorder', reorderBannersHandler);
router.patch('/:id', updateBannerHandler);
router.delete('/:id', deleteBannerHandler);

export default router;