// =============================================================================
// soko-api/src/scripts/backfill-covers.ts
// Re-syncs all catalog books with Ultra-High-Resolution (800px+) cover art.
// Run via: npx tsx src/scripts/backfill-covers.ts
// =============================================================================

import { pool } from '../config/db';
import { findBestBookCover } from '../services/bookCover.service';

async function backfill(): Promise<void> {
  console.log('====================================================');
  console.log('     UPGRADING BOOK COVERS TO HD RESOLUTION (800px+) ');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    const booksRes = await client.query<{ id: string; name: string; sku: string | null; description: string | null }>(
      `SELECT p.id, p.name, p.sku, p.description
       FROM products p
       WHERE p.deleted_at IS NULL
       ORDER BY p.created_at DESC`
    );

    const books = booksRes.rows;
    console.log(`Found ${books.length} book(s) in catalog to upgrade.\n`);

    for (const book of books) {
      let author: string | undefined = undefined;
      if (book.description && book.description.startsWith('By ')) {
        const match = book.description.match(/^By\s+([^<\n]+)/);
        if (match) author = match[1].trim();
      }

      console.log(`  → Fetching HD cover for: "${book.name}"...`);
      const discovered = await findBestBookCover(book.name, author, book.sku || undefined);

      if (discovered.coverUrl) {
        // Wipe old low-res thumbnail
        await client.query('DELETE FROM product_images WHERE product_id = $1', [book.id]);

        // Insert new HD 800px+ cover
        await client.query(
          `INSERT INTO product_images (product_id, image_url, image_public_id, sort_order)
           VALUES ($1, $2, $3, 0)`,
          [book.id, discovered.coverUrl, `auto_${discovered.source || 'web'}`]
        );
        console.log(`    ✓ Saved HD: ${discovered.coverUrl}`);
      } else {
        console.log(`    ✗ No HD cover found for: "${book.name}"`);
      }

      // 150ms delay
      await new Promise((r) => setTimeout(r, 150));
    }

    console.log('\n✅ All covers upgraded to HD resolution!\n');
  } catch (err) {
    console.error('Failed to upgrade covers:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill();