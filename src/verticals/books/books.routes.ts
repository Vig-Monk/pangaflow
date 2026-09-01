// =============================================================================
// src/verticals/books/books.routes.ts
// Master router for the books vertical: downloads, R2 uploads, and bulk import pipeline.
// =============================================================================

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth';
import downloadRoutes from './download.routes';
import importRoutes from './import/import.routes';
import {
  getPresignedR2UploadUrlHandler,
  getBookstoreStorageStatsHandler,
} from './books.controller';

const router = Router();

// Public download routes: GET /api/v1/books/download/:token
router.use('/download', downloadRoutes);

// Protected bulk import routes: /api/v1/books/import
router.use('/import', importRoutes);

// Protected R2 direct presigned upload URL: POST /api/v1/books/upload-url
router.post('/upload-url', verifyToken, getPresignedR2UploadUrlHandler);

// Protected Storage telemetry stats: GET /api/v1/books/storage-stats
router.get('/storage-stats', verifyToken, getBookstoreStorageStatsHandler);

export default router;