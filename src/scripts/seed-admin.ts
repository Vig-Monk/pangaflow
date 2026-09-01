// =============================================================================
// soko-api/src/scripts/seed-admin.ts
// Unifies the entire catalog, organization, store, and admin user credentials.
// Run via: npx tsx src/scripts/seed-admin.ts
// =============================================================================

import bcrypt from 'bcryptjs';
import { pool } from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = (process.env.FLEMELA_ADMIN_EMAIL || 'admin@flemela.co.ke').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.FLEMELA_ADMIN_PASSWORD || 'AdminPassword123!';
const STORE_SLUG = (process.env.NUXT_PUBLIC_STORE_SLUG || 'flemela').trim().toLowerCase();

async function run(): Promise<void> {
  console.log('====================================================');
  console.log('    UNIFYING CATALOG & ADMIN TENANT BINDING         ');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure Organization
    const orgRes = await client.query<{ id: string }>(
      `INSERT INTO organizations (name, slug, business_type, plan, plan_expires_at)
       VALUES ('Flemela Bookstore', $1, 'books', 'lifetime', NULL)
       ON CONFLICT (slug) DO UPDATE SET
         business_type = 'books',
         plan = 'lifetime',
         deleted_at = NULL,
         updated_at = NOW()
       RETURNING id`,
      [STORE_SLUG]
    );
    const orgId = orgRes.rows[0].id;
    console.log(`✓ Flagship Organization [ID: ${orgId}, Slug: "${STORE_SLUG}"]`);

    // 2. Hash password with bcryptjs (12 rounds)
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    // 3. Upsert User
    const userRes = await client.query<{ id: string; email: string }>(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, 'Flemela Store Administrator')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         deleted_at = NULL,
         updated_at = NOW()
       RETURNING id, email`,
      [ADMIN_EMAIL, passwordHash]
    );
    const userId = userRes.rows[0].id;
    console.log(`✓ Admin User [ID: ${userId}, Email: "${ADMIN_EMAIL}"]`);

    // 4. Ensure Owner Membership
    await client.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (org_id, user_id) DO UPDATE SET
         role = 'owner'`,
      [orgId, userId]
    );
    console.log(`✓ Organization Membership bound [Role: owner]`);

    // 5. Ensure Published Storefront Record
    await client.query(
      `INSERT INTO stores (
         org_id, slug, name, description, location, delivery_info, status, hero_layout
       )
       VALUES (
         $1, $2, 'Flemela Bookstore',
         'Books that inspire. Knowledge that transforms.',
         'Sarit Centre, Westlands, Nairobi',
         'Free delivery across Nairobi on orders above KSh 2,500',
         'published', 'editorial'
       )
       ON CONFLICT (org_id) DO UPDATE SET
         slug = EXCLUDED.slug,
         status = 'published',
         updated_at = NOW()`,
      [orgId, STORE_SLUG]
    );
    console.log(`✓ Storefront published [Slug: "${STORE_SLUG}"]`);

    // 6. Reassign All Orphaned/Discrepant Catalog Books to this Org
    const reassignProducts = await client.query(
      `UPDATE products SET org_id = $1 WHERE org_id != $1`,
      [orgId]
    );
    console.log(`✓ Reassigned ${reassignProducts.rowCount || 0} product(s) to this flagship org`);

    const reassignCategories = await client.query(
      `UPDATE categories SET org_id = $1 WHERE org_id != $1`,
      [orgId]
    );
    console.log(`✓ Reassigned ${reassignCategories.rowCount || 0} category row(s)`);

    // 7. Verify Product Count
    const countCheck = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM products WHERE org_id = $1 AND deleted_at IS NULL`,
      [orgId]
    );
    console.log(`✓ Total books now visible to admin: ${countCheck.rows[0]?.count}`);

    await client.query('COMMIT');

    console.log('\n====================================================');
    console.log(`✅ SUCCESS: Catalog and Admin session unified.`);
    console.log(`   Admin Email:    ${ADMIN_EMAIL}`);
    console.log(`   Admin Password: ${ADMIN_PASSWORD}`);
    console.log('====================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Unification failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();