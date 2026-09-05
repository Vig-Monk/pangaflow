// =============================================================================
// soko-api/src/scripts/backfill-covers.ts
// Re-syncs catalog books with Ultra-High-Resolution (800px+) cover art safely.
// Run via: npx tsx src/scripts/backfill-covers.ts [--force]
// =============================================================================

import { pool } from '../config/db';
import {
  findBestBookCover,
  cleanAuthorString,
  extractValidIsbn,
} from '../services/bookCover.service';

interface BookRow {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  existing_cover: string | null;
}

function extractAuthorFromDescription(description?: string | null): string | undefined {
  if (!description) return undefined;
  const stripped = description.replace(/<[^>]*>/g, ' ').trim();

  const match =
    stripped.match(/(?:^|\n|\.\s+)(?:By|Author|Written by)[:\s]+([A-Z][a-zA-Z\s.'-]+?)(?:\.|\n|<|$|,|\()/i) ||
    stripped.match(/^By\s+([^<\n\r]+)/i) ||
    stripped.match(/Author:\s*([^<\n\r]+)/i);

  if (match && match[1]) {
    const cleaned = cleanAuthorString(match[1]);
    return cleaned.length >= 2 && cleaned.length <= 60 ? cleaned : undefined;
  }

  return undefined;
}

async function backfill(): Promise<void> {
  const isForceMode = process.argv.includes('--force');

  console.log('================================================================');
  console.log('   FLEMELA: HIGH-DEFINITION (800px+) COVER UPGRADE ENGINE       ');
  console.log(`   Mode: ${isForceMode ? 'Force Refresh (All Books)' : 'Upgrade Low-Res & Missing Only'}`);
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    const booksRes = await client.query<BookRow>(
      `SELECT p.id, p.name, p.sku, p.description,
              (SELECT pi.image_url 
               FROM product_images pi 
               WHERE pi.product_id = p.id 
               ORDER BY pi.sort_order ASC LIMIT 1) AS existing_cover
       FROM products p
       WHERE p.deleted_at IS NULL
       ORDER BY p.created_at DESC`
    );

    const books = booksRes.rows;
    console.log(`Found ${books.length} catalog title(s) to inspect.\n`);

    let upgradedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      const progress = `[${i + 1}/${books.length}]`;

      const hasExistingCloudinary =
        book.existing_cover &&
        book.existing_cover.includes('cloudinary.com') &&
        !book.existing_cover.includes('placeholder');

      const isLowResZoom = book.existing_cover && book.existing_cover.includes('zoom=1');

      if (hasExistingCloudinary && !isLowResZoom && !isForceMode) {
        console.log(`${progress} ⏩ Skipping: "${book.name}" (Already has high-res Cloudinary cover)`);
        skippedCount++;
        continue;
      }

      const author = extractAuthorFromDescription(book.description);
      const isbn = extractValidIsbn(book.sku) || extractValidIsbn(book.description);

      console.log(`${progress} 🔍 Resolving HD cover for: "${book.name}"${author ? ` (Author: ${author})` : ''}...`);

      const discovered = await findBestBookCover(book.name, author, isbn || undefined);

      if (discovered.coverUrl) {
        await client.query('BEGIN');
        try {
          await client.query('DELETE FROM product_images WHERE product_id = $1', [book.id]);

          await client.query(
            `INSERT INTO product_images (product_id, image_url, image_public_id, sort_order)
             VALUES ($1, $2, $3, 0)`,
            [book.id, discovered.coverUrl, `auto_${discovered.source || 'web'}`]
          );

          await client.query('COMMIT');
          console.log(`     ✓ Saved HD (${discovered.source?.toUpperCase()}): ${discovered.coverUrl}`);
          upgradedCount++;
        } catch (dbErr) {
          await client.query('ROLLBACK');
          console.error(`     ✗ DB Error saving image for "${book.name}":`, dbErr);
          failedCount++;
        }
      } else {
        console.log(`     ✗ No cover located for: "${book.name}"`);
        failedCount++;
      }

      // 400ms delay between items to stay well within rate limits
      await new Promise((r) => setTimeout(r, 400));
    }

    console.log('\n================================================================');
    console.log('                    COVER BACKFILL COMPLETE                     ');
    console.log('================================================================');
    console.log(`  ✓ Total Inspected:       ${books.length}`);
    console.log(`  ✓ Successfully Upgraded: ${upgradedCount}`);
    console.log(`  ⏩ Skipped (Already HD):  ${skippedCount}`);
    console.log(`  ✗ Not Found / Failed:    ${failedCount}`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('Fatal backfill error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill();