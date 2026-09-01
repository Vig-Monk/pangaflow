// =============================================================================
// src/verticals/books/import/import.routes.ts
// Route wiring for bulk import operations with Multer upload handling.
// =============================================================================

import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { verifyToken } from '../../../middleware/auth';
import {
  uploadExcelImportHandler,
  startGoogleSheetImportHandler,
  getImportStatusHandler,
} from './import.controller';

const upload = multer({
  dest: path.join(os.tmpdir(), 'flemela-imports'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max spreadsheet size
});

const router = Router();

router.use(verifyToken);

// POST /api/v1/books/import/excel (Multipart file upload)
router.post('/excel', upload.single('file'), uploadExcelImportHandler);

// POST /api/v1/books/import/google-sheet (JSON { sheetUrl })
router.post('/google-sheet', startGoogleSheetImportHandler);

// GET /api/v1/books/import/:id (Poll progress & error rows)
router.get('/:id', getImportStatusHandler);

export default router;