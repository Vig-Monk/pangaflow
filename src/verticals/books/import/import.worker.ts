// =============================================================================
// soko-api/src/verticals/books/import/import.worker.ts
// Background BullMQ Spreadsheet Ingestion Worker with Inverted Cover Hierarchy.
// =============================================================================

import { Worker, Job } from 'bullmq';
import ExcelJS from 'exceljs';
import axios from 'axios';
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
  hardcopyPrice?: number;
  hardcopyStock?: number;
  pdfPrice?: number;
  pdfFileUrl?: string;
  epubPrice?: number;
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
  await importQueries.updateJobProgress(jobId, 0, totalRows, 'processing');

  let processedCount = 0;

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
      const hardcopyPrice = parseFloat(extractCellString(getVal(['salepricekes', 'pricekes', 'price', 'hardcopyprice'])) || '0');
      const hardcopyStock = parseInt(extractCellString(getVal(['stock', 'quantity', 'hardcopystock'])) || '0', 10);
      const pdfFileUrl = sanitizeGoogleDriveUrl(getVal(['pdffile', 'pdffileurl', 'pdfurl', 'pdflink']));
      const pdfPrice = parseFloat(extractCellString(getVal(['pdfsprice', 'pdfprice', 'ebookprice'])) || '0');
      const epubFileUrl = sanitizeGoogleDriveUrl(getVal(['epubfile', 'epubfileurl', 'epuburl', 'epublink']));
      const epubPrice = parseFloat(extractCellString(getVal(['epubsprice', 'epubprice'])) || '0');
      const coverImageUrl = extractCellString(getVal(['image1', 'image2', 'coverimageurl', 'coverurl']));
      const coverBuffer = imageMapByRow[r];

      await createBookWithFormatsFromImport(orgId, {
        rowNumber: r,
        title: titleVal,
        author: author || undefined,
        sku: sku || undefined,
        isbn: sku || undefined,
        category: category || 'General',
        description: description || undefined,
        hardcopyPrice: hardcopyPrice > 0 ? hardcopyPrice : undefined,
        hardcopyStock: hardcopyStock >= 0 ? hardcopyStock : 10,
        pdfPrice: pdfPrice > 0 ? pdfPrice : undefined,
        pdfFileUrl,
        epubPrice: epubPrice > 0 ? epubPrice : undefined,
        epubFileUrl,
        coverImageUrl: coverImageUrl || undefined,
        coverBuffer,
      });

      processedCount++;
    } catch (rowErr: any) {
      await importQueries.appendJobError(jobId, {
        row: r,
        title: titleVal,
        error: rowErr.message || 'Row processing failed',
      });
    } finally {
      if (r % 5 === 0) {
        await importQueries.updateJobProgress(jobId, processedCount, totalRows, 'processing');
      }
      await sleep(150);
    }
  }

  await importQueries.finalizeImportJob(jobId, 'done', processedCount);
  fs.unlink(filePath, () => {});
}

async function processGoogleSheet(
  jobId: string,
  orgId: string,
  sheetUrl: string
): Promise<void> {
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid Google Sheet URL. Ensure link contains /d/<SHEET_ID>');
  }

  const sheetId = match[1];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const response = await axios.get<string>(csvUrl, { timeout: 15000 });
  const lines = response.data.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('Google Sheet is empty or contains only headers');
  }

  const headerRow = lines[0].split(',').map((h) => normalizeHeader(h));
  const titleCol = headerRow.findIndex((h) => h === 'name' || h === 'title' || h === 'booktitle');

  if (titleCol === -1) {
    throw new Error('Google Sheet must contain a "Name" or "Title" column');
  }

  const totalRows = lines.length - 1;
  await importQueries.updateJobProgress(jobId, 0, totalRows, 'processing');

  let processedCount = 0;

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const titleVal = cols[titleCol];

    if (!titleVal) continue;

    try {
      const getVal = (names: string[]): string | undefined => {
        for (const n of names) {
          const idx = headerRow.indexOf(n);
          if (idx !== -1 && cols[idx]) return cols[idx];
        }
        return undefined;
      };

      const description = getVal(['description', 'synopsis']);
      const sku = getVal(['sellersku', 'sku', 'isbn', 'barcode']);
      const category = getVal(['primarycategory', 'category', 'genre']) || 'General';
      const author = getVal(['author', 'authorname']);
      const hardcopyPrice = parseFloat(getVal(['salepricekes', 'pricekes', 'price']) || '0');
      const hardcopyStock = parseInt(getVal(['stock', 'quantity']) || '10', 10);
      const pdfFileUrl = sanitizeGoogleDriveUrl(getVal(['pdffile', 'pdfurl', 'pdffileurl']));
      const pdfPrice = parseFloat(getVal(['pdfsprice', 'pdfprice']) || '0');
      const epubFileUrl = sanitizeGoogleDriveUrl(getVal(['epubfile', 'epuburl']));
      const epubPrice = parseFloat(getVal(['epubsprice', 'epubprice']) || '0');
      const coverImageUrl = getVal(['image1', 'image2', 'coverimageurl', 'coverurl']);

      await createBookWithFormatsFromImport(orgId, {
        rowNumber: r + 1,
        title: titleVal,
        author,
        sku,
        isbn: sku,
        category,
        description,
        hardcopyPrice: hardcopyPrice > 0 ? hardcopyPrice : undefined,
        hardcopyStock,
        pdfPrice: pdfPrice > 0 ? pdfPrice : undefined,
        pdfFileUrl,
        epubPrice: epubPrice > 0 ? epubPrice : undefined,
        epubFileUrl,
        coverImageUrl,
      });

      processedCount++;
    } catch (rowErr: any) {
      await importQueries.appendJobError(jobId, {
        row: r + 1,
        title: titleVal,
        error: rowErr.message || 'Row import failed',
      });
    } finally {
      if (r % 5 === 0) {
        await importQueries.updateJobProgress(jobId, processedCount, totalRows, 'processing');
      }
      await sleep(150);
    }
  }

  await importQueries.finalizeImportJob(jobId, 'done', processedCount);
}

async function createBookWithFormatsFromImport(
  orgId: string,
  row: ParsedBookRow
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Category
    const categoryName = row.category || 'General';
    const categoryId = await findOrCreateCategoryByName(client, orgId, categoryName);

    // 2. Inverted Cover Resolution Waterfall
    let targetImageUrl: string | null = null;
    let targetImageBuffer: Buffer | undefined = undefined;

    try {
      const discovered = await findBestBookCover(row.title, row.author, row.isbn || row.sku);
      if (discovered.coverUrl) {
        targetImageUrl = discovered.coverUrl;
      }
    } catch (err) {
      console.warn(`Cover discovery non-blocking failure for "${row.title}":`, err);
    }

    if (!targetImageUrl) {
      targetImageUrl = row.coverImageUrl || null;
      targetImageBuffer = row.coverBuffer;
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

    const basePrice = row.hardcopyPrice || row.pdfPrice || row.epubPrice || 999;
    const baseStock = row.hardcopyStock || 0;
    const cleanSlugTitle = row.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50);
    const slug = `${cleanSlugTitle}-${Date.now().toString().slice(-4)}`;

    // 3. Insert Product
    const productId = await insertProductTransactional(client, orgId, {
      category_id: categoryId,
      name: row.title,
      slug,
      sku: row.sku || null,
      description: row.description || (row.author ? `By ${row.author}` : null),
      cost_price: null,
      price: basePrice,
      status: 'published',
    });

    // 4. Base Inventory
    await insertInventoryTransactional(client, productId, baseStock);

    // 5. Attach Cover Image
    if (finalImageUrl) {
      await insertProductImageTransactional(
        client,
        productId,
        finalImageUrl,
        finalImagePublicId,
        0
      );
    }

    await client.query('COMMIT');

    // 6. Hardcopy Format
    if (row.hardcopyPrice) {
      await createProductFormat(orgId, productId, {
        format: 'hardcopy',
        price: row.hardcopyPrice,
        stock: row.hardcopyStock ?? 10,
      });
    }

    // 7. Stream PDF to Cloudflare R2
    if (row.pdfPrice && row.pdfFileUrl) {
      let r2Key: string | null = null;
      let r2SizeBytes: number | null = null;

      if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
        try {
          const streamResult = await streamRemoteUrlToR2(
            row.pdfFileUrl,
            orgId,
            `${cleanSlugTitle}.pdf`,
            'application/pdf'
          );
          r2Key = streamResult.key;
          r2SizeBytes = streamResult.fileSizeBytes;
        } catch (err) {
          console.warn(`Direct R2 stream failed for ${row.title}:`, err);
        }
      }

      await createProductFormat(orgId, productId, {
        format: 'pdf',
        price: row.pdfPrice,
        fileUrl: r2Key || row.pdfFileUrl,
        filePublicId: r2Key,
        fileSizeBytes: r2SizeBytes,
      });
    }

    // 8. Stream EPUB to Cloudflare R2
    if (row.epubPrice && row.epubFileUrl) {
      let r2Key: string | null = null;
      let r2SizeBytes: number | null = null;

      if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
        try {
          const streamResult = await streamRemoteUrlToR2(
            row.epubFileUrl,
            orgId,
            `${cleanSlugTitle}.epub`,
            'application/epub+zip'
          );
          r2Key = streamResult.key;
          r2SizeBytes = streamResult.fileSizeBytes;
        } catch (err) {
          console.warn(`Direct R2 EPUB stream failed for ${row.title}:`, err);
        }
      }

      await createProductFormat(orgId, productId, {
        format: 'epub',
        price: row.epubPrice,
        fileUrl: r2Key || row.epubFileUrl,
        filePublicId: r2Key,
        fileSizeBytes: r2SizeBytes,
      });
    }
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