// =============================================================================
// src/modules/product-formats/product-formats.routes.ts
// Route wiring for product formats. Mounted with { mergeParams: true }.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import {
  listFormatsHandler,
  getFormatHandler,
  createFormatHandler,
  updateFormatHandler,
  deleteFormatHandler,
} from './product-formats.controller';

const router = Router({ mergeParams: true });

router.use(verifyToken);

router.get('/', listFormatsHandler);
router.post('/', createFormatHandler);
router.get('/:id', getFormatHandler);
router.patch('/:id', updateFormatHandler);
router.delete('/:id', deleteFormatHandler);

export default router;