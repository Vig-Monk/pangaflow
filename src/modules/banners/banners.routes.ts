// =============================================================================
// soko-api/src/modules/banners/banners.routes.ts
// Route wiring for promotional hero banners.
// =============================================================================

import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../../middleware/auth';
import { AppError } from '../../utils/error';
import {
  listPublicBannersHandler,
  trackBannerClickHandler,
  listAdminBannersHandler,
  createBannerHandler,
  updateBannerHandler,
  deleteBannerHandler,
  reorderBannersHandler,
  uploadBannerImageHandler,
} from './banners.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image files are allowed', 400));
    }
  },
});

const router = Router();

// 1. Public Storefront Endpoints (No Auth Required)
router.get('/public/:storeSlug', listPublicBannersHandler);
router.post('/:id/click', trackBannerClickHandler);

// 2. Admin Management Endpoints (Requires Valid Admin Bearer JWT)
router.use(verifyToken);

router.get('/', listAdminBannersHandler);
router.post('/', createBannerHandler);
router.post('/upload', upload.single('file'), uploadBannerImageHandler);
router.post('/reorder', reorderBannersHandler);
router.patch('/:id', updateBannerHandler);
router.delete('/:id', deleteBannerHandler);

export default router;