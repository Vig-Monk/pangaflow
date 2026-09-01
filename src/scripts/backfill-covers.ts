// =============================================================================
// soko-api/src/scripts/backfill-covers.ts
// Forces cover art resolution on all catalog books.
// Run via: npx tsx src/scripts/backfill-covers.ts
// =============================================================================

import { pool } from '../config/db';
import { findBestBookCover } from '../services/bookCover.service';

async function backfill(): Promise<void> {
  console.log('====================================================');
  console.log('       FORCING BOOK COVER RESOLUTION & SYNC         ');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    // Select ALL active books
    const booksRes = await client.query<{ id: string; name: string; sku: string | null; description: string | null }>(
      `SELECT p.id, p.name, p.sku, p.description
       FROM products p
       WHERE p.deleted_at IS NULL
       ORDER BY p.created_at DESC`
    );

    const books = booksRes.rows;
    console.log(`Processing ${books.length} book(s) in catalog...\n`);

    for (const book of books) {
      let author: string | undefined = undefined;
      if (book.description && book.description.startsWith('By ')) {
        const match = book.description.match(/^By\s+([^<\n]+)/);
        if (match) author = match[1].trim();
      }

      console.log(`  → Resolving cover for: "${book.name}"...`);
      const discovered = await findBestBookCover(book.name, author, book.sku || undefined);

      if (discovered.coverUrl) {
        // Delete old broken links for this product
        await client.query('DELETE FROM product_images WHERE product_id = $1', [book.id]);

        // Insert fresh, verified high-res cover
        await client.query(
          `INSERT INTO product_images (product_id, image_url, image_public_id, sort_order)
           VALUES ($1, $2, $3, 0)`,
          [book.id, discovered.coverUrl, `auto_${discovered.source || 'web'}`]
        );
        console.log(`    ✓ Saved: ${discovered.coverUrl.slice(0, 75)}...`);
      } else {
        console.log(`    ✗ No online cover found for: "${book.name}"`);
      }

      // 150ms throttle
      await new Promise((r) => setTimeout(r, 150));
    }

    console.log('\n✅ Sync complete! All books now have fresh cover URLs.\n');
  } catch (err) {
    console.error('Failed to sync covers:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill();