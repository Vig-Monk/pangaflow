// src/verticals/books/import/import.routes.ts
// =============================================================================
// Route wiring for bulk import operations with Multer extension retention.
// =============================================================================

import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { verifyToken } from '../../../middleware/auth';
import { AppError } from '../../../utils/error';
import {
  uploadExcelImportHandler,
  startGoogleSheetImportHandler,
  getImportStatusHandler,
} from './import.controller';

const uploadDir = path.join(os.tmpdir(), 'flemela-imports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.xlsx';
    cb(null, `import-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.csv', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError('Only Excel (.xlsx, .xls) and CSV (.csv) files are supported', 400));
    }
  },
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