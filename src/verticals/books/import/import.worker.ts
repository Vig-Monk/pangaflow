// =============================================================================
// soko-api/src/verticals/books/import/import.worker.ts
// In-process Spreadsheet & Google Sheet ingestion worker with deduplication
// =============================================================================

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import ExcelJS from 'exceljs';
import { pool } from '../../../../config/db';
import {
  findOrCreateCategoryByName,
  insertProductTransactional,
  insertInventoryTransactional,
  insertProductImageTransactional,
} from '../../../../modules/products/products.queries';
import { findBestBookCover } from '../../../../services/bookCover.service';
import * as importQueries from './import.queries';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ParsedBookRow {
  title: string;
  author?: string | null;
  sku?: string | null;
  category?: string | null;
  description?: string | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  pdfPrice?: number | null;
  epubPrice?: number | null;
  hardcopyStock?: number | null;
  coverImageUrl?: string | null;
  pdfFileUrl?: string | null;
  epubFileUrl?: string | null;
}

// -----------------------------------------------------------------------------
// Excel Cell Parsing Helpers
// -----------------------------------------------------------------------------

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function getCellValueAsString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (typeof value === 'object') {
    const val = value as Record<string, unknown>;
    if (Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t?.text || '').join('').trim();
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text.trim();
    }
    if ('hyperlink' in val && typeof val.hyperlink === 'string') {
      return val.hyperlink.trim();
    }
    if ('result' in val) {
      return String(val.result ?? '').trim();
    }
  }

  return String(value).trim();
}

function getCellValueAsNumber(value: unknown): number | null {
  const str = getCellValueAsString(value).replace(/[^0-9.-]/g, '');
  if (!str) return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// -----------------------------------------------------------------------------
// Database Ingestion & Deduplication
// -----------------------------------------------------------------------------

async function upsertBookFromImport(
  orgId: string,
  row: ParsedBookRow
): Promise<'inserted' | 'updated' | 'skipped'> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Safe Category Resolution
    const categoryName = row.category || 'General';
    const categoryId = await findOrCreateCategoryByName(client, orgId, categoryName);

    // 2. Pre-Flight Duplicate Check (SKU first, fallback to Title)
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

    // 3. Price & Discount Normalization (Respects chk_products_compare_at_price constraint)
    let sellingPrice = row.salePrice || row.regularPrice || row.pdfPrice || row.epubPrice || 999;
    let compareAtPrice: number | null = null;

    if (row.regularPrice && row.salePrice && row.regularPrice > row.salePrice) {
      sellingPrice = row.salePrice;
      compareAtPrice = row.regularPrice;
    }

    // 4. Auto-discover cover art if no image link was provided
    let targetImageUrl: string | null = row.coverImageUrl || null;

    if (!targetImageUrl) {
      try {
        const discovered = await findBestBookCover(
          row.title,
          row.author || undefined,
          row.sku || undefined
        );
        if (discovered?.coverUrl) {
          targetImageUrl = discovered.coverUrl;
        }
      } catch {
        // Non-blocking fallback
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

      if (row.hardcopyStock !== undefined && row.hardcopyStock !== null) {
        await client.query(
          `UPDATE inventory 
           SET stock = $2, updated_at = NOW() 
           WHERE product_id = $1`,
          [existingProductId, row.hardcopyStock]
        );
      }

      // Attach discovered cover if existing book has no image
      if (targetImageUrl) {
        const hasImg = await client.query(
          `SELECT 1 FROM product_images WHERE product_id = $1 LIMIT 1`,
          [existingProductId]
        );
        if (hasImg.rows.length === 0) {
          await insertProductImageTransactional(
            client,
            existingProductId,
            targetImageUrl,
            'auto_cover',
            0
          );
        }
      }
    } else {
      outcome = 'inserted';
      const cleanSlugTitle = row.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40);
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

      // Attach cover if found or provided
      if (targetImageUrl) {
        await insertProductImageTransactional(
          client,
          productId,
          targetImageUrl,
          'auto_cover',
          0
        );
      }
    }

    // 5. Hardcopy Format
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

    // 6. Digital PDF Format
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

    // 7. Digital EPUB Format
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

// -----------------------------------------------------------------------------
// Excel File Processor
// -----------------------------------------------------------------------------

export async function processExcelFile(
  jobId: string,
  orgId: string,
  filePath: string
): Promise<void> {
  let totalRows = 0;
  let processedRows = 0;
  let insertedRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;

  try {
    const workbook = new ExcelJS.Workbook();
    const isCsv = filePath.toLowerCase().endsWith('.csv');

    if (isCsv) {
      await workbook.csv.readFile(filePath);
    } else {
      await workbook.xlsx.readFile(filePath);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Worksheet is empty or corrupted');
    }

    const headerRow = worksheet.getRow(1);
    const headerMap = new Map<string, number>();

    headerRow.eachCell((cell, colNumber) => {
      const headerStr = getCellValueAsString(cell.value);
      if (headerStr) {
        headerMap.set(normalizeHeader(headerStr), colNumber);
      }
    });

    const rowsCount = worksheet.rowCount;
    totalRows = Math.max(0, rowsCount - 1);

    await importQueries.updateJobProgress(
      jobId,
      { processedRows: 0, totalRows },
      'processing'
    );

    for (let rowNumber = 2; rowNumber <= rowsCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      let hasData = false;
      row.eachCell(() => {
        hasData = true;
      });

      if (!hasData) {
        skippedRows++;
        processedRows++;
        continue;
      }

      const getVal = (possibleKeys: string[]): unknown => {
        for (const key of possibleKeys) {
          const col = headerMap.get(key);
          if (col) {
            return row.getCell(col).value;
          }
        }
        return undefined;
      };

      const title = getCellValueAsString(getVal(['name', 'title', 'booktitle']));

      if (!title) {
        skippedRows++;
        processedRows++;
        continue;
      }

      const description = getCellValueAsString(getVal(['description', 'synopsis', 'details'])) || null;
      const sku = getCellValueAsString(getVal(['sellersku', 'sku', 'isbn', 'barcode'])) || null;
      const category = getCellValueAsString(getVal(['primarycategory', 'category', 'categories'])) || 'General';
      const author = getCellValueAsString(getVal(['author', 'authors', 'writtenby'])) || null;

      const regularPrice = getCellValueAsNumber(getVal(['pricekes', 'price', 'regularprice', 'regularpricekes']));
      const salePrice = getCellValueAsNumber(getVal(['salepricekes', 'saleprice', 'discountprice']));
      const pdfPrice = getCellValueAsNumber(getVal(['pdfsprice', 'pdfprice', 'ebookprice']));
      const epubPrice = getCellValueAsNumber(getVal(['epubprice']));
      const hardcopyStock = getCellValueAsNumber(getVal(['stock', 'quantity', 'hardcopystock', 'inventory']));

      const coverImageUrl = getCellValueAsString(getVal(['image1', 'image', 'cover', 'coverimage', 'coverimageurl', 'imageurl'])) || null;
      const pdfFileUrl = getCellValueAsString(getVal(['pdffile', 'pdfurl', 'pdffileurl', 'pdf'])) || null;
      const epubFileUrl = getCellValueAsString(getVal(['epubfile', 'epuburl', 'epubfileurl', 'epub'])) || null;

      const parsedRow: ParsedBookRow = {
        title,
        author,
        sku,
        category,
        description,
        regularPrice,
        salePrice,
        pdfPrice,
        epubPrice,
        hardcopyStock: hardcopyStock !== null ? Math.max(0, Math.floor(hardcopyStock)) : null,
        coverImageUrl,
        pdfFileUrl,
        epubFileUrl,
      };

      try {
        const outcome = await upsertBookFromImport(orgId, parsedRow);
        if (outcome === 'inserted') insertedRows++;
        else if (outcome === 'updated') updatedRows++;
        else skippedRows++;
      } catch (rowErr: any) {
        skippedRows++;
        await importQueries.appendJobError(jobId, {
          row: rowNumber,
          title,
          error: rowErr.message || 'Row processing failed',
        });
      }

      processedRows++;

      if (processedRows % 10 === 0 || processedRows === totalRows) {
        await importQueries.updateJobProgress(
          jobId,
          {
            processedRows,
            insertedRows,
            updatedRows,
            skippedRows,
            totalRows,
          },
          'processing'
        );
      }
    }

    await importQueries.finalizeImportJob(jobId, 'done', {
      processedRows,
      insertedRows,
      updatedRows,
      skippedRows,
    });
  } catch (err: any) {
    console.error(`[Process Excel File Error] Job ${jobId}:`, err);
    await importQueries.finalizeImportJob(
      jobId,
      'failed',
      undefined,
      err.message || 'Workbook processing error'
    );
    throw err;
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore file cleanup error
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Google Sheet Processor
// -----------------------------------------------------------------------------

export async function processGoogleSheet(
  jobId: string,
  orgId: string,
  sheetUrl: string
): Promise<void> {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid Google Sheet URL. Could not extract spreadsheet ID.');
  }

  const sheetId = match[1];
  const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const tempFilePath = path.join(os.tmpdir(), `gsheet-${jobId}-${Date.now()}.csv`);

  try {
    const response = await axios.get<string>(csvExportUrl, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.data || typeof response.data !== 'string') {
      throw new Error('Received empty response from Google Sheet');
    }

    if (response.data.includes('<!DOCTYPE html>') || response.data.includes('<html')) {
      throw new Error(
        'Google Sheet is private or requires authentication. Please set link sharing to "Anyone with the link can view".'
      );
    }

    fs.writeFileSync(tempFilePath, response.data, 'utf8');

    await processExcelFile(jobId, orgId, tempFilePath);
  } catch (err: any) {
    console.error(`[Process Google Sheet Error] Job ${jobId}:`, err);
    await importQueries.finalizeImportJob(
      jobId,
      'failed',
      undefined,
      err.message || 'Google Sheet fetch failed'
    );
    throw err;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // Ignore cleanup error
      }
    }
  }
}