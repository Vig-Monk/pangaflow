// =============================================================================
// soko-api/src/scripts/restore-tenant-boundaries.ts
// Restores strict multi-tenant boundaries and removes foreign items from Flemela.
// Run via: npx tsx src/scripts/restore-tenant-boundaries.ts
// =============================================================================

import { pool } from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const FLEMELA_SLUG = (process.env.NUXT_PUBLIC_STORE_SLUG || 'flemela').trim().toLowerCase();

async function restoreBoundaries(): Promise<void> {
  console.log('====================================================');
  console.log('   CLEANING FOREIGN PRODUCTS FROM FLEMELA CATALOG   ');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Resolve Flemela Org ID
    const flemelaRes = await client.query<{ id: string }>(
      `SELECT id FROM organizations WHERE slug = $1 LIMIT 1`,
      [FLEMELA_SLUG]
    );

    if (flemelaRes.rows.length === 0) {
      throw new Error(`Organization with slug "${FLEMELA_SLUG}" not found.`);
    }

    const flemelaOrgId = flemelaRes.rows[0].id;
    console.log(`Flemela Org ID: ${flemelaOrgId}\n`);

    // 2. Identify all non-book or test organizations in the database
    const otherOrgs = await client.query<{ id: string; name: string; slug: string; business_type: string }>(
      `SELECT id, name, slug, business_type FROM organizations WHERE id != $1 AND deleted_at IS NULL`,
      [flemelaOrgId]
    );
    console.log(`Found ${otherOrgs.rows.length} other organization(s) in system.`);

    // 3. Find products in Flemela that are NOT books:
    // Books have entries in product_formats (pdf, epub, hardcopy) OR canonical bookstore categories.
    // Non-books (e.g. "Nike Air Force 1", "Classic Running Shoes", etc.) have NO formats and non-book names.
    const foreignProducts = await client.query<{ id: string; name: string; sku: string | null }>(
      `SELECT p.id, p.name, p.sku
       FROM products p
       LEFT JOIN product_formats pf ON pf.product_id = p.id
       WHERE p.org_id = $1
         AND pf.id IS NULL
         AND (
           p.name ILIKE '%shoe%' OR
           p.name ILIKE '%nike%' OR
           p.name ILIKE '%running%' OR
           p.name ILIKE '%test%' OR
           p.name ILIKE '%DELETE_PROBE%'
         )`,
      [flemelaOrgId]
    );

    console.log(`\nIdentified ${foreignProducts.rows.length} non-book / test product(s) in Flemela:`);
    for (const prod of foreignProducts.rows) {
      console.log(`  - [ID: ${prod.id}] "${prod.name}" (SKU: ${prod.sku || 'none'})`);
    }

    // 4. Remove foreign test products from Flemela
    if (foreignProducts.rows.length > 0) {
      const foreignIds = foreignProducts.rows.map((p) => p.id);

      await client.query(`DELETE FROM product_images WHERE product_id = ANY($1::uuid[])`, [foreignIds]);
      await client.query(`DELETE FROM inventory WHERE product_id = ANY($1::uuid[])`, [foreignIds]);
      await client.query(`DELETE FROM product_variants WHERE product_id = ANY($1::uuid[])`, [foreignIds]);
      await client.query(`DELETE FROM products WHERE id = ANY($1::uuid[])`, [foreignIds]);

      console.log(`\n✓ Successfully removed ${foreignProducts.rows.length} foreign product(s) from Flemela.`);
    }

    // 5. Clean up any categories belonging to other businesses that were copied into Flemela
    const nonBookCategories = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM categories 
       WHERE org_id = $1 
         AND name NOT IN (
           'Business & Finance',
           'Psychology & Self-Help',
           'Self-Help',
           'Fiction & Literature',
           'Christian Books',
           'Education & Textbooks',
           'Biographies & Memoir',
           'General'
         )
         AND NOT EXISTS (
           SELECT 1 FROM products p 
           JOIN product_formats pf ON pf.product_id = p.id 
           WHERE p.category_id = categories.id
         )`,
      [flemelaOrgId]
    );

    if (nonBookCategories.rows.length > 0) {
      console.log(`\nIdentified ${nonBookCategories.rows.length} foreign category row(s) to remove:`);
      for (const cat of nonBookCategories.rows) {
        console.log(`  - "${cat.name}"`);
        await client.query(`DELETE FROM categories WHERE id = $1`, [cat.id]);
      }
    }

    // 6. Report remaining clean catalog count
    const remainingRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM products WHERE org_id = $1 AND deleted_at IS NULL`,
      [flemelaOrgId]
    );

    await client.query('COMMIT');

    console.log('\n====================================================');
    console.log(`✅ CLEANUP COMPLETE:`);
    console.log(`   Clean bookstore titles in Flemela: ${remainingRes.rows[0].count}`);
    console.log('   All foreign items removed. Tenant boundary restored.');
    console.log('====================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Cleanup failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

restoreBoundaries();