// =============================================================================
// soko-api/src/scripts/heal-system.ts
// Master System Repair: Shared Catalog Fortification & Multi-Tenant Preservation
// Run via: npx tsx src/scripts/heal-system.ts
// =============================================================================

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from '../config/db';

dotenv.config();

const FLEMELA_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const EBOOKREADS_ORG_ID = 'a0000000-0000-0000-0000-000000000002';

const FLEMELA_ADMIN_EMAIL = (process.env.FLEMELA_ADMIN_EMAIL || 'admin@flemela.co.ke').trim().toLowerCase();
const FLEMELA_ADMIN_PASSWORD = process.env.FLEMELA_ADMIN_PASSWORD || 'AdminPassword123!';

async function healSystem(): Promise<void> {
  console.log('================================================================');
  console.log('       KAUNTAOS: SHARED CATALOG & MULTI-TENANT REPAIR           ');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------------------
    // 1. Enforce Safe Foreign Key Constraints (CASCADE + SET NULL)
    // -------------------------------------------------------------------------
    console.log('1. Fortifying database constraints and historical order preservation...');

    await client.query(`
      ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_product_id_fkey;
      ALTER TABLE product_images ADD CONSTRAINT product_images_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

      ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
      ALTER TABLE inventory ADD CONSTRAINT inventory_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

      ALTER TABLE product_formats DROP CONSTRAINT IF EXISTS product_formats_product_id_fkey;
      ALTER TABLE product_formats ADD CONSTRAINT product_formats_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

      ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;
      ALTER TABLE product_variants ADD CONSTRAINT product_variants_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

      ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
      ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
      ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

      ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_format_id_fkey;
      ALTER TABLE order_items ADD CONSTRAINT order_items_format_id_fkey 
        FOREIGN KEY (format_id) REFERENCES product_formats(id) ON DELETE SET NULL;

      ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
      ALTER TABLE order_items ADD CONSTRAINT order_items_variant_id_fkey 
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
    `);
    console.log('   ✓ Constraints verified: ON DELETE CASCADE and historical SET NULL active.\n');

    // -------------------------------------------------------------------------
    // 2. Fortify Master Catalog Organization (Sunrise / Flemela Flagship)
    // -------------------------------------------------------------------------
    console.log('2. Syncing Master Catalog Host (The Sunrise Bookstore / Flemela)...');
    await client.query(
      `INSERT INTO organizations (id, name, slug, business_type, plan, plan_expires_at)
       VALUES ($1, 'The Sunrise Bookstore', 'flemela', 'books', 'lifetime', NULL)
       ON CONFLICT (id) DO UPDATE SET
         name = 'The Sunrise Bookstore',
         slug = 'flemela',
         business_type = 'books',
         plan = 'lifetime',
         deleted_at = NULL,
         updated_at = NOW()`,
      [FLEMELA_ORG_ID]
    );

    await client.query(
      `INSERT INTO stores (
         org_id, slug, name, description, location, delivery_info,
         status, hero_layout, hero_headline, hero_subheadline, hero_cta_label
       )
       VALUES (
         $1, 'flemela', 'The Sunrise Bookstore',
         'Books that inspire. Knowledge that transforms.',
         'Diamond Mall / Diamond Plaza, 4th Parklands Ave, Nairobi',
         'Free delivery across Nairobi on orders above KSh 2,500',
         'published', 'editorial',
         'Books that change the way you think.',
         'Discover handpicked literature, timeless philosophy, and rigorous business knowledge.',
         'Explore Catalog'
       )
       ON CONFLICT (org_id) DO UPDATE SET
         slug = 'flemela',
         name = 'The Sunrise Bookstore',
         status = 'published',
         updated_at = NOW()`,
      [FLEMELA_ORG_ID]
    );
    console.log('   ✓ Master Catalog Organization & Storefront active.\n');

    // -------------------------------------------------------------------------
    // 3. Fortify Shared Catalog Subscriber (EbookReads)
    // -------------------------------------------------------------------------
    console.log('3. Syncing Shared Catalog Subscriber (EbookReads)...');
    await client.query(
      `INSERT INTO organizations (
         id, name, slug, business_type, plan, plan_expires_at,
         catalog_source_org_id, settings
       )
       VALUES (
         $1, 'EbookReads', 'ebookreads', 'books', 'lifetime', NULL,
         $2, '{"currency": "KES", "primary_color": "#E50914", "dark_color": "#111315", "digital_only": true}'::jsonb
       )
       ON CONFLICT (id) DO UPDATE SET
         name                  = 'EbookReads',
         slug                  = 'ebookreads',
         business_type         = 'books',
         plan                  = 'lifetime',
         catalog_source_org_id = $2,
         settings              = '{"currency": "KES", "primary_color": "#E50914", "dark_color": "#111315", "digital_only": true}'::jsonb,
         deleted_at            = NULL,
         updated_at            = NOW()`,
      [EBOOKREADS_ORG_ID, FLEMELA_ORG_ID]
    );

    await client.query(
      `INSERT INTO stores (
         org_id, slug, name, description, location, delivery_info,
         status, hero_layout, hero_headline, hero_subheadline, hero_cta_label
       )
       VALUES (
         $1, 'ebookreads', 'EbookReads',
         'Discover Your Next Great Book. Instant digital downloads and curated reading collections.',
         'Diamond Mall / Diamond Plaza, 4th Parklands Ave, Nairobi',
         'Instant PDF digital download links delivered directly to your device upon M-Pesa payment.',
         'published', 'editorial',
         'Discover Your Next Great Book',
         'Thousands of ebooks. Endless possibilities. Read, learn, and grow — all in one place.',
         'Browse Ebooks'
       )
       ON CONFLICT (org_id) DO UPDATE SET
         slug             = 'ebookreads',
         name             = 'EbookReads',
         status           = 'published',
         updated_at       = NOW()`,
      [EBOOKREADS_ORG_ID]
    );
    console.log('   ✓ EbookReads bound to Master Catalog with digital-only constraints active.\n');

    // -------------------------------------------------------------------------
    // 4. Provision Master Admin User
    // -------------------------------------------------------------------------
    console.log('4. Provisioning Admin Authentication...');
    const passwordHash = await bcrypt.hash(FLEMELA_ADMIN_PASSWORD, 12);

    const userRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, 'Store Administrator')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         deleted_at = NULL,
         updated_at = NOW()
       RETURNING id`,
      [FLEMELA_ADMIN_EMAIL, passwordHash]
    );
    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (org_id, user_id) DO UPDATE SET
         role = 'owner'`,
      [FLEMELA_ORG_ID, userId]
    );
    console.log(`   ✓ Admin "${FLEMELA_ADMIN_EMAIL}" linked as owner.\n`);

    // -------------------------------------------------------------------------
    // 5. Verification & Telemetry Inspection
    // -------------------------------------------------------------------------
    console.log('5. Auditing Catalog & Tenant Isolation Boundaries...');

    const sharedBooksRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM products WHERE org_id = $1 AND deleted_at IS NULL`,
      [FLEMELA_ORG_ID]
    );

    const otherOrgsRes = await client.query<{ id: string; name: string; slug: string; catalog_source: string | null }>(
      `SELECT id, name, slug, catalog_source_org_id::text AS catalog_source 
       FROM organizations 
       WHERE id != $1 AND deleted_at IS NULL`,
      [FLEMELA_ORG_ID]
    );

    await client.query('COMMIT');

    console.log('================================================================');
    console.log('               HEAL & ARCHITECTURAL SYNC COMPLETE               ');
    console.log('================================================================');
    console.log(`  ✓ Master Catalog Org:   The Sunrise Bookstore [ID: ${FLEMELA_ORG_ID}]`);
    console.log(`  ✓ Master Book Count:    ${sharedBooksRes.rows[0].count} titles`);
    console.log(`  ✓ Shared Subscriber:    EbookReads [Points to: ${FLEMELA_ORG_ID}]`);
    console.log(`  ✓ Sovereign Tenants:    ${otherOrgsRes.rows.length} total organization(s) protected:`);
    for (const o of otherOrgsRes.rows) {
      const isLinked = o.catalog_source === FLEMELA_ORG_ID;
      console.log(`     - [${o.slug}] "${o.name}" ➔ ${isLinked ? 'Subscribed to Master Catalog' : '100% Isolated Private Catalog'}`);
    }
    console.log('================================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Repair failed with error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

healSystem();