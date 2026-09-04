// =============================================================================
// soko-api/src/verticals/books/import/import.worker.ts
// Ingestion Worker with Pre-Flight Duplicate Merging and R2 Asset Deduplication.
// =============================================================================

import { Worker, Job } from 'bullmq';
import ExcelJS from 'exceljs';
//import axios from 'axios';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { pool } from '../../../config/db';
import { env } from '../../../config/env';
import { redisConnection } from './import.service';
import * as importQueries from './import.queries';
import { streamRemoteUrlToR2 } from '../../../services/r2.service';
import { findBestBookCover } from '../../../services/bookCover.service';
import {
  findOrCreateCategoryByName,
  insertProductTransactional,
  insertInventoryTransactional,
  insertProductImageTransactional,
} from '../../../modules/products/products.queries';
import { createProductFormat } from '../../../modules/product-formats/product-formats.queries';

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

function sanitizeGoogleDriveUrl(rawVal: any): string | undefined {
  const urlStr = extractCellString(rawVal);
  if (!urlStr || urlStr.length < 5) return undefined;

  const match = urlStr.match(/\/d\/([a-zA-Z0-9_-]+)/) || urlStr.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}&confirm=t`;
  }
  return urlStr;
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

function normalizeHeader(val: any): string {
  return String(val || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processExcelFile(
  jobId: string,
  orgId: string,
  filePath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(filePath);
  } catch {
    await workbook.csv.readFile(filePath);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Spreadsheet contains no valid worksheet');
  }

  const headerMap: Record<string, number> = {};
  const firstRow = worksheet.getRow(1);

  firstRow.eachCell((cell, colNumber) => {
    const norm = normalizeHeader(cell.value);
    headerMap[norm] = colNumber;
  });

  const titleCol = headerMap['name'] || headerMap['title'] || headerMap['booktitle'];
  if (!titleCol) {
    throw new Error('Spreadsheet must have a "Name" or "Title" column header');
  }

  const imageMapByRow: Record<number, Buffer> = {};
  try {
    const images = worksheet.getImages();
    for (const img of images) {
      const media = workbook.model.media?.find((m: any) => m.index === (img as any).imageId);
      if (media && media.buffer) {
        const row = Math.floor((img as any).range.tl.row) + 1;
        imageMapByRow[row] = Buffer.from(media.buffer);
      }
    }
  } catch {
    // Non-blocking preview extract
  }

  const totalRows = Math.max(0, worksheet.rowCount - 1);
  await importQueries.updateJobProgress(jobId, { processedRows: 0, totalRows }, 'processing');

  let processedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const titleVal = extractCellString(row.getCell(titleCol).value);

    if (!titleVal) continue;

    try {
      const getVal = (keys: string[]): any => {
        for (const k of keys) {
          const col = headerMap[k];
          if (col) {
            const v = row.getCell(col).value;
            if (v !== null && v !== undefined) return v;
          }
        }
        return null;
      };

      const description = extractCellString(getVal(['description', 'synopsis']));
      const sku = extractCellString(getVal(['sellersku', 'sku', 'isbn', 'barcode']));
      const category = extractCellString(getVal(['primarycategory', 'category', 'genre']));
      const author = extractCellString(getVal(['author', 'authorname']));

      const regularPrice = parseFloat(extractCellString(getVal(['pricekes', 'price', 'regularprice'])) || '0');
      const salePrice = parseFloat(extractCellString(getVal(['salepricekes', 'saleprice', 'discountedprice'])) || '0');
      const hardcopyStock = parseInt(extractCellString(getVal(['stock', 'quantity', 'hardcopystock'])) || '10', 10);

      const pdfFileUrl = sanitizeGoogleDriveUrl(getVal(['pdffile', 'pdffileurl', 'pdfurl', 'pdflink']));
      const pdfPrice = parseFloat(extractCellString(getVal(['pdfsprice', 'pdfprice', 'ebookprice'])) || '0');
      const epubFileUrl = sanitizeGoogleDriveUrl(getVal(['epubfile', 'epubfileurl', 'epuburl', 'epublink']));
      const epubPrice = parseFloat(extractCellString(getVal(['epubsprice', 'epubprice'])) || '0');

      const coverImageUrl = extractCellString(getVal(['image1', 'image2', 'coverimageurl', 'coverurl']));
      const coverBuffer = imageMapByRow[r];

      const outcome = await upsertBookFromImport(orgId, {
        rowNumber: r,
        title: titleVal,
        author: author || undefined,
        sku: sku || undefined,
        isbn: sku || undefined,
        category: category || 'General',
        description: description || undefined,
        regularPrice: regularPrice > 0 ? regularPrice : undefined,
        salePrice: salePrice > 0 ? salePrice : (regularPrice > 0 ? regularPrice : undefined),
        hardcopyStock: hardcopyStock >= 0 ? hardcopyStock : 10,
        pdfPrice: pdfPrice > 0 ? pdfPrice : undefined,
        pdfFileUrl,
        epubPrice: epubPrice > 0 ? epubPrice : undefined,
        epubFileUrl,
        coverImageUrl: coverImageUrl || undefined,
        coverBuffer,
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
    } finally {
      if (r % 5 === 0) {
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
      await sleep(100);
    }
  }

  await importQueries.finalizeImportJob(jobId, 'done', {
    processedRows: processedCount,
    insertedRows: insertedCount,
    updatedRows: updatedCount,
    skippedRows: skippedCount,
  });

  fs.unlink(filePath, () => {});
}

/**
 * Smart Pre-Flight Check: Upserts existing books by SKU or Title/Author without duplication.
 */
async function upsertBookFromImport(
  orgId: string,
  row: ParsedBookRow
): Promise<'inserted' | 'updated' | 'skipped'> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Resolve Category
    const categoryName = row.category || 'General';
    const categoryId = await findOrCreateCategoryByName(client, orgId, categoryName);

    // 2. Pre-Flight Duplicate Lookup: Match on SKU first, or fallback to exact Title & Author
    let existingProductId: string | null = null;

    if (row.sku && row.sku.trim()) {
      const skuCheck = await client.query<{ id: string }>(
        `SELECT id FROM products WHERE org_id = $1 AND LOWER(TRIM(sku)) = LOWER(TRIM($2)) AND deleted_at IS NULL LIMIT 1`,
        [orgId, row.sku.trim()]
      );
      if (skuCheck.rows.length > 0) {
        existingProductId = skuCheck.rows[0].id;
      }
    }

    if (!existingProductId) {
      const titleCheck = await client.query<{ id: string }>(
        `SELECT id FROM products WHERE org_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND deleted_at IS NULL LIMIT 1`,
        [orgId, row.title.trim()]
      );
      if (titleCheck.rows.length > 0) {
        existingProductId = titleCheck.rows[0].id;
      }
    }

    // 3. Price and Discount Normalization
    let sellingPrice = row.salePrice || row.regularPrice || row.pdfPrice || row.epubPrice || 999;
    let compareAtPrice: number | null = null;

    if (row.regularPrice && row.salePrice && row.regularPrice > row.salePrice) {
      sellingPrice = row.salePrice;
      compareAtPrice = row.regularPrice;
    }

    let targetImageUrl: string | null = null;
    let targetImageBuffer: Buffer | undefined = undefined;

    // Only discover/upload cover if it's a new book or existing product has no images
    if (!existingProductId) {
      try {
        const discovered = await findBestBookCover(row.title, row.author, row.isbn || row.sku);
        if (discovered.coverUrl) {
          targetImageUrl = discovered.coverUrl;
        }
      } catch {
        // Non-blocking fallback
      }

      if (!targetImageUrl) {
        targetImageUrl = row.coverImageUrl || null;
        targetImageBuffer = row.coverBuffer;
      }
    }

    let finalImageUrl: string | null = targetImageUrl;
    let finalImagePublicId = 'cover_img';

    if (targetImageBuffer || targetImageUrl) {
      const uploadedImage = await uploadCoverToCloudinary(orgId, {
        buffer: targetImageBuffer,
        url: targetImageUrl || undefined,
      });

      if (uploadedImage) {
        finalImageUrl = uploadedImage.url;
        finalImagePublicId = uploadedImage.publicId;
      }
    }

    let productId = existingProductId;
    let outcome: 'inserted' | 'updated' = 'inserted';

    if (existingProductId) {
      // -----------------------------------------------------------------------
      // EXISTING BOOK: Update without creating duplicates
      // -----------------------------------------------------------------------
      outcome = 'updated';
      await client.query(
        `UPDATE products
         SET category_id      = $2,
             price            = $3,
             compare_at_price = $4,
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

      // Increment / update physical inventory stock
      if (row.hardcopyStock !== undefined) {
        await client.query(
          `UPDATE inventory SET stock = stock + $2, updated_at = NOW() WHERE product_id = $1`,
          [existingProductId, row.hardcopyStock]
        );
      }
    } else {
      // -----------------------------------------------------------------------
      // NEW BOOK: Insert fresh product
      // -----------------------------------------------------------------------
      outcome = 'inserted';
      const cleanSlugTitle = row.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50);
      const slug = `${cleanSlugTitle}-${Date.now().toString().slice(-4)}`;

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

    await client.query('COMMIT');

    // 4. Formats Upsert (Hardcopy)
    if (productId && sellingPrice) {
      await createProductFormat(orgId, productId, {
        format: 'hardcopy',
        price: sellingPrice,
        compareAtPrice,
        stock: row.hardcopyStock ?? 10,
      });
    }

    // 5. Digital PDF File (Only stream to R2 if format file does not already exist)
    if (productId && row.pdfPrice && row.pdfFileUrl) {
      const existingPdf = await pool.query<{ file_url: string | null }>(
        `SELECT file_url FROM product_formats WHERE product_id = $1 AND format = 'pdf'`,
        [productId]
      );

      let r2Key = existingPdf.rows[0]?.file_url || null;
      let r2SizeBytes: number | null = null;

      // Stream to R2 only if absent
      if (!r2Key && env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
        try {
          const cleanName = row.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '-').slice(0, 30);
          const streamResult = await streamRemoteUrlToR2(
            row.pdfFileUrl,
            orgId,
            `${cleanName}.pdf`,
            'application/pdf'
          );
          r2Key = streamResult.key;
          r2SizeBytes = streamResult.fileSizeBytes;
        } catch {
          r2Key = row.pdfFileUrl;
        }
      }

      await createProductFormat(orgId, productId, {
        format: 'pdf',
        price: row.pdfPrice,
        compareAtPrice: null,
        fileUrl: r2Key || row.pdfFileUrl,
        filePublicId: r2Key,
        fileSizeBytes: r2SizeBytes,
      });
    }

    // 6. Digital EPUB File
    if (productId && row.epubPrice && row.epubFileUrl) {
      const existingEpub = await pool.query<{ file_url: string | null }>(
        `SELECT file_url FROM product_formats WHERE product_id = $1 AND format = 'epub'`,
        [productId]
      );

      let r2Key = existingEpub.rows[0]?.file_url || null;
      let r2SizeBytes: number | null = null;

      if (!r2Key && env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
        try {
          const cleanName = row.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '-').slice(0, 30);
          const streamResult = await streamRemoteUrlToR2(
            row.epubFileUrl,
            orgId,
            `${cleanName}.epub`,
            'application/epub+zip'
          );
          r2Key = streamResult.key;
          r2SizeBytes = streamResult.fileSizeBytes;
        } catch {
          r2Key = row.epubFileUrl;
        }
      }

      await createProductFormat(orgId, productId, {
        format: 'epub',
        price: row.epubPrice,
        compareAtPrice: null,
        fileUrl: r2Key || row.epubFileUrl,
        filePublicId: r2Key,
        fileSizeBytes: r2SizeBytes,
      });
    }

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
    const { jobId, orgId, source, filePath } = job.data;

    try {
      if (source === 'excel' && filePath) {
        await processExcelFile(jobId, orgId, filePath);
      }
    } catch (err: any) {
      await importQueries.finalizeImportJob(jobId, 'failed');
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);