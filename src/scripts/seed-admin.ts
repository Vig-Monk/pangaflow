// =============================================================================
// soko-api/src/scripts/seed-admin.ts
// Securely verifies Flemela organization, storefront, and admin credentials
// WITHOUT touching or reassigning products from other tenant accounts.
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
  console.log('    VERIFYING FLEMELA TENANT & ADMIN ACCESS         ');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure Flagship Organization
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
    console.log(`✓ Organization confirmed [ID: ${orgId}, Slug: "${STORE_SLUG}"]`);

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

    await client.query('COMMIT');

    console.log('\n====================================================');
    console.log(`✅ Tenant check complete. Other organizations were untouched.`);
    console.log('====================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Operation failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();