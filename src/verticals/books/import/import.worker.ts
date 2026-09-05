// =============================================================================
// soko-api/src/verticals/books/import/import.worker.ts
// Ingestion Worker: Resilient Dual Parser, Currency Sanitizer & Atomic Transactions.
// =============================================================================

import { Worker, Job } from 'bullmq';
import ExcelJS from 'exceljs';
import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { pool } from '../../../config/db';
import { env } from '../../../config/env';
import { createRedisConnection } from './import.service';
import * as importQueries from './import.queries';
import { findBestBookCover } from '../../../services/bookCover.service';
import {
  findOrCreateCategoryByName,
  insertProductTransactional,
  insertInventoryTransactional,
  insertProductImageTransactional,
} from '../../../modules/products/products.queries';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

interface ImportJobPayload {
  jobId: string;
  orgId: string;
  source: 'excel' | 'google_sheet';
  filePath?: string;
  sheetUrl?: string;
}

interface ParsedBookRow {
  rowNumber: number;
  title: string;
  author?: string;
  sku?: string;
  isbn?: string;
  category?: string;
  description?: string;
  regularPrice?: number;
  salePrice?: number;
  hardcopyStock?: number;
  pdfPrice?: number;
  pdfCompareAtPrice?: number;
  pdfFileUrl?: string;
  epubPrice?: number;
  epubCompareAtPrice?: number;
  epubFileUrl?: string;
  coverImageUrl?: string;
  coverBuffer?: Buffer;
}

function extractCellString(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'string') return cellValue.trim();
  if (typeof cellValue === 'number' || typeof cellValue === 'boolean') return String(cellValue).trim();

  if (typeof cellValue === 'object') {
    if (cellValue.hyperlink) return String(cellValue.hyperlink).trim();
    if (cellValue.text) return String(cellValue.text).trim();
    if (cellValue.result) return String(cellValue.result).trim();
    if (Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((t: any) => t.text || '').join('').trim();
    }
  }

  return String(cellValue).trim();
}

function parseCleanNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : Math.max(0, val);

  const rawStr = extractCellString(val);
  if (!rawStr) return fallback;

  const cleaned = rawStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : Math.max(0, parsed);
}

function parseCleanInt(val: any, fallback = 10): number {
  if (val === null || val === undefined) return fallback;
  const rawStr = extractCellString(val);
  if (rawStr === '') return fallback;

  const cleaned = rawStr.replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? fallback : Math.max(0, parsed);
}

function sanitizeGoogleDriveUrl(rawVal: any): string | undefined {
  const urlStr = extractCellString(rawVal);
  if (!urlStr || urlStr.length < 5) return undefined;

  const match = urlStr.match(/\/d\/([a-zA-Z0-9_-]+)/) || urlStr.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}&confirm=t`;
  }
  return urlStr;
}

function normalizeHeader(val: any): string {
  return String(val || '')
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function sniffCsvDelimiter(filePath: string): string {
  try {
    const buffer = Buffer.alloc(2048);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);

    const text = buffer.toString('utf8', 0, bytesRead).split(/\r?\n/)[0] || '';
    const commas = (text.match(/,/g) || []).length;
    const semicolons = (text.match(/;/g) || []).length;
    const tabs = (text.match(/\t/g) || []).length;

    if (semicolons > commas && semicolons > tabs) return ';';
    if (tabs > commas && tabs > semicolons) return '\t';
    return ',';
  } catch {
    return ',';
  }
}

async function loadWorkbookSafely(filePath: string): Promise<ExcelJS.Workbook> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    const csvWorkbook = new ExcelJS.Workbook();
    const delimiter = sniffCsvDelimiter(filePath);
    await csvWorkbook.csv.readFile(filePath, {
      parserOptions: { delimiter },
    });
    return csvWorkbook;
  }

  const xlsxWorkbook = new ExcelJS.Workbook();
  try {
    await xlsxWorkbook.xlsx.readFile(filePath);
    return xlsxWorkbook;
  } catch (xlsxErr: any) {
    try {
      const fallbackCsvWorkbook = new ExcelJS.Workbook();
      const delimiter = sniffCsvDelimiter(filePath);
      await fallbackCsvWorkbook.csv.readFile(filePath, {
        parserOptions: { delimiter },
      });
      return fallbackCsvWorkbook;
    } catch {
      throw new Error(
        `Failed to parse spreadsheet. Ensure it is a valid .xlsx or .csv file. (${xlsxErr.message})`
      );
    }
  }
}

async function uploadCoverToCloudinary(
  orgId: string,
  imageSource: { buffer?: Buffer; url?: string }
): Promise<{ url: string; publicId: string } | null> {
  const folder = `flemela/${orgId}/products`;

  if (imageSource.buffer) {
    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) resolve(null);
          else resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      uploadStream.end(imageSource.buffer);
    });
  }

  if (imageSource.url) {
    try {
      const result = await cloudinary.uploader.upload(imageSource.url, {
        folder,
        resource_type: 'image',
      });
      return { url: result.secure_url, publicId: result.public_id };
    } catch {
      return null;
    }
  }

  return null;
}

async function processExcelFile(
  jobId: string,
  orgId: string,
  filePath: string
): Promise<void> {
  const workbook = await loadWorkbookSafely(filePath);
  const worksheet = workbook.worksheets[0];

  if (!worksheet || worksheet.rowCount === 0) {
    throw new Error('Spreadsheet contains no readable rows or valid worksheet.');
  }

  const headerMap: Record<string, number> = {};
  const firstRow = worksheet.getRow(1);

  firstRow.eachCell((cell, colNumber) => {
    const norm = normalizeHeader(cell.value);
    if (norm) {
      headerMap[norm] = colNumber;
    }
  });

  const titleCol =
    headerMap['name'] ||
    headerMap['title'] ||
    headerMap['booktitle'] ||
    headerMap['productname'] ||
    headerMap['itemname'];

  if (!titleCol) {
    throw new Error(
      'Spreadsheet must have a "Name" or "Title" column header. Found headers: ' +
        Object.keys(headerMap).slice(0, 8).join(', ')
    );
  }

  let actualDataRows = 0;
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const val = extractCellString(worksheet.getRow(r).getCell(titleCol).value);
    if (val) actualDataRows++;
  }

  const totalRows = Math.max(1, actualDataRows);
  await importQueries.updateJobProgress(jobId, { processedRows: 0, totalRows }, 'processing');

  let processedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  const getVal = (row: ExcelJS.Row, keys: string[]): any => {
    for (const k of keys) {
      const col = headerMap[k];
      if (col) {
        const v = row.getCell(col).value;
        if (v !== null && v !== undefined) return v;
      }
    }
    return null;
  };

  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const titleVal = extractCellString(row.getCell(titleCol).value);

    if (!titleVal) continue;

    try {
      const description = extractCellString(getVal(row, ['description', 'synopsis', 'summary', 'about', 'details']));
      const sku = extractCellString(getVal(row, ['sellersku', 'sku', 'isbn', 'isbn13', 'isbn10', 'barcode']));
      const category = extractCellString(getVal(row, ['primarycategory', 'category', 'genre', 'categories', 'collection']));
      const author = extractCellString(getVal(row, ['author', 'authorname', 'writer', 'authors']));

      const regularPrice = parseCleanNumber(getVal(row, ['pricekes', 'price', 'regularprice', 'listprice', 'msrp', 'amount']), 0);
      const salePrice = parseCleanNumber(getVal(row, ['salepricekes', 'saleprice', 'discountedprice', 'offerprice', 'specialprice']), 0);
      const hardcopyStock = parseCleanInt(getVal(row, ['stock', 'quantity', 'hardcopystock', 'qty', 'inventory']), 10);

      const pdfFileUrl = sanitizeGoogleDriveUrl(getVal(row, ['pdffile', 'pdffileurl', 'pdfurl', 'pdflink', 'pdf', 'ebookurl']));
      const pdfPrice = parseCleanNumber(getVal(row, ['pdfsprice', 'pdfprice', 'ebookprice']), 0);
      const epubFileUrl = sanitizeGoogleDriveUrl(getVal(row, ['epubfile', 'epubfileurl', 'epuburl', 'epublink', 'epub']));
      const epubPrice = parseCleanNumber(getVal(row, ['epubsprice', 'epubprice']), 0);

      const coverImageUrl = extractCellString(getVal(row, ['image1', 'image2', 'coverimageurl', 'coverurl', 'cover', 'photo', 'image']));

      const outcome = await upsertBookFromImport(orgId, {
        rowNumber: r,
        title: titleVal,
        author: author || undefined,
        sku: sku || undefined,
        isbn: sku || undefined,
        category: category || 'General',
        description: description || undefined,
        regularPrice: regularPrice > 0 ? regularPrice : undefined,
        salePrice: salePrice > 0 ? salePrice : regularPrice > 0 ? regularPrice : undefined,
        hardcopyStock,
        pdfPrice: pdfPrice > 0 ? pdfPrice : regularPrice > 0 ? regularPrice : undefined,
        pdfFileUrl,
        epubPrice: epubPrice > 0 ? epubPrice : regularPrice > 0 ? regularPrice : undefined,
        epubFileUrl,
        coverImageUrl: coverImageUrl || undefined,
      });

      if (outcome === 'inserted') insertedCount++;
      else if (outcome === 'updated') updatedCount++;
      else skippedCount++;

      processedCount++;
    } catch (rowErr: any) {
      await importQueries.appendJobError(jobId, {
        row: r,
        title: titleVal,
        error: rowErr.message || 'Row processing failed',
      });
      skippedCount++;
    } finally {
      // Updates progress on every row immediately so the progress bar is responsive
      await importQueries.updateJobProgress(
        jobId,
        {
          processedRows: processedCount,
          insertedRows: insertedCount,
          updatedRows: updatedCount,
          skippedRows: skippedCount,
        },
        'processing'
      );
    }
  }

  await importQueries.finalizeImportJob(jobId, 'done', {
    processedRows: processedCount,
    insertedRows: insertedCount,
    updatedRows: updatedCount,
    skippedRows: skippedCount,
  });
}

async function processGoogleSheet(
  jobId: string,
  orgId: string,
  sheetUrl: string
): Promise<void> {
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid Google Sheet URL format. Unable to extract Sheet ID.');
  }

  const sheetId = match[1];
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const tempFilePath = path.join(os.tmpdir(), `gsheet-${jobId}-${Date.now()}.csv`);

  try {
    const response = await axios.get(exportUrl, {
      responseType: 'stream',
      timeout: 20000,
    });

    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);
      writer.on('finish', () => resolve());
      writer.on('error', (err) => reject(err));
    });

    await processExcelFile(jobId, orgId, tempFilePath);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, () => {});
    }
  }
}

async function upsertBookFromImport(
  orgId: string,
  row: ParsedBookRow
): Promise<'inserted' | 'updated' | 'skipped'> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const categoryName = row.category || 'General';
    const categoryId = await findOrCreateCategoryByName(client, orgId, categoryName);

    let existingProductId: string | null = null;

    if (row.sku && row.sku.trim()) {
      const skuCheck = await client.query<{ id: string }>(
        `SELECT id FROM products 
         WHERE org_id = $1 AND LOWER(TRIM(sku)) = LOWER(TRIM($2)) AND deleted_at IS NULL 
         LIMIT 1`,
        [orgId, row.sku.trim()]
      );
      if (skuCheck.rows.length > 0) {
        existingProductId = skuCheck.rows[0].id;
      }
    }

    if (!existingProductId) {
      const titleCheck = await client.query<{ id: string }>(
        `SELECT id FROM products 
         WHERE org_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND deleted_at IS NULL 
         LIMIT 1`,
        [orgId, row.title.trim()]
      );
      if (titleCheck.rows.length > 0) {
        existingProductId = titleCheck.rows[0].id;
      }
    }

    let sellingPrice = row.salePrice || row.regularPrice || row.pdfPrice || row.epubPrice || 999;
    let compareAtPrice: number | null = null;

    if (row.regularPrice && row.salePrice && row.regularPrice > row.salePrice) {
      sellingPrice = row.salePrice;
      compareAtPrice = row.regularPrice;
    }

    let targetImageUrl: string | null = row.coverImageUrl || null;

    if (!existingProductId && !targetImageUrl) {
      try {
        const discovered = await findBestBookCover(row.title, row.author, row.isbn || row.sku);
        if (discovered.coverUrl) {
          targetImageUrl = discovered.coverUrl;
        }
      } catch {
        // Fallback safely
      }
    }

    let finalImageUrl: string | null = targetImageUrl;
    let finalImagePublicId = 'cover_img';

    if (targetImageUrl && targetImageUrl.startsWith('http') && !targetImageUrl.includes('cloudinary.com')) {
      const uploadedImage = await uploadCoverToCloudinary(orgId, { url: targetImageUrl });
      if (uploadedImage) {
        finalImageUrl = uploadedImage.url;
        finalImagePublicId = uploadedImage.publicId;
      }
    }

    let productId = existingProductId;
    let outcome: 'inserted' | 'updated' = 'inserted';

    if (existingProductId) {
      outcome = 'updated';
      await client.query(
        `UPDATE products
         SET category_id      = $2,
             price            = $3,
             compare_at_price = COALESCE($4, compare_at_price),
             sku              = COALESCE(products.sku, $5),
             description      = COALESCE($6, products.description),
             badge            = (CASE WHEN $4 IS NOT NULL THEN 'FLASH_SALE' ELSE products.badge END),
             updated_at       = NOW()
         WHERE id = $1 AND org_id = $7`,
        [
          existingProductId,
          categoryId,
          sellingPrice,
          compareAtPrice,
          row.sku || null,
          row.description || (row.author ? `By ${row.author}` : null),
          orgId,
        ]
      );

      if (row.hardcopyStock !== undefined) {
        await client.query(
          `UPDATE inventory 
           SET stock = $2, updated_at = NOW() 
           WHERE product_id = $1`,
          [existingProductId, row.hardcopyStock]
        );
      }
    } else {
      outcome = 'inserted';
      const cleanSlugTitle = row.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 45);
      const slugSuffix = crypto.randomBytes(3).toString('hex');
      const slug = `${cleanSlugTitle}-${slugSuffix}`;

      productId = await insertProductTransactional(client, orgId, {
        category_id: categoryId,
        name: row.title,
        slug,
        sku: row.sku || null,
        description: row.description || (row.author ? `By ${row.author}` : null),
        cost_price: null,
        price: sellingPrice,
        compare_at_price: compareAtPrice,
        badge: compareAtPrice ? 'FLASH_SALE' : null,
        status: 'published',
      });

      await insertInventoryTransactional(client, productId, row.hardcopyStock || 10);

      if (finalImageUrl) {
        await insertProductImageTransactional(
          client,
          productId,
          finalImageUrl,
          finalImagePublicId,
          0
        );
      }
    }

    if (productId && sellingPrice) {
      await client.query(
        `INSERT INTO product_formats (
           product_id, format, price, compare_at_price, stock
         )
         VALUES ($1, 'hardcopy', $2, $3, $4)
         ON CONFLICT (product_id, format) DO UPDATE SET
           price            = EXCLUDED.price,
           compare_at_price = EXCLUDED.compare_at_price,
           stock            = EXCLUDED.stock,
           updated_at       = NOW()`,
        [productId, sellingPrice, compareAtPrice, row.hardcopyStock ?? 10]
      );
    }

    if (productId && (row.pdfFileUrl || row.pdfPrice)) {
      const formatPrice = row.pdfPrice && row.pdfPrice > 0 ? row.pdfPrice : sellingPrice;

      await client.query(
        `INSERT INTO product_formats (
           product_id, format, price, compare_at_price, file_url, file_public_id
         )
         VALUES ($1, 'pdf', $2, NULL, $3, $3)
         ON CONFLICT (product_id, format) DO UPDATE SET
           price            = EXCLUDED.price,
           file_url         = COALESCE(EXCLUDED.file_url, product_formats.file_url),
           file_public_id   = COALESCE(EXCLUDED.file_public_id, product_formats.file_public_id),
           updated_at       = NOW()`,
        [productId, formatPrice, row.pdfFileUrl || null]
      );
    }

    if (productId && (row.epubFileUrl || row.epubPrice)) {
      const formatPrice = row.epubPrice && row.epubPrice > 0 ? row.epubPrice : sellingPrice;

      await client.query(
        `INSERT INTO product_formats (
           product_id, format, price, compare_at_price, file_url, file_public_id
         )
         VALUES ($1, 'epub', $2, NULL, $3, $3)
         ON CONFLICT (product_id, format) DO UPDATE SET
           price            = EXCLUDED.price,
           file_url         = COALESCE(EXCLUDED.file_url, product_formats.file_url),
           file_public_id   = COALESCE(EXCLUDED.file_public_id, product_formats.file_public_id),
           updated_at       = NOW()`,
        [productId, formatPrice, row.epubFileUrl || null]
      );
    }

    await client.query('COMMIT');
    return outcome;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export const bookImportWorker = new Worker<ImportJobPayload>(
  'book-import-queue',
  async (job: Job<ImportJobPayload>) => {
    const { jobId, orgId, source, filePath, sheetUrl } = job.data;

    try {
      if (source === 'excel' && filePath) {
        await processExcelFile(jobId, orgId, filePath);
      } else if (source === 'google_sheet' && sheetUrl) {
        await processGoogleSheet(jobId, orgId, sheetUrl);
      } else {
        throw new Error('Invalid import source or missing parameters.');
      }
    } catch (err: any) {
      await importQueries.finalizeImportJob(jobId, 'failed', undefined, err.message);
      throw err;
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 1,
    lockDuration: 60000,
  }
);