-- =============================================================================
-- Migration: 019_seed_flemela_flagship.sql
-- Soko Platform — Idempotent Flagship Tenant Seed (Flemela Bookstore)
-- =============================================================================

-- 1. Deterministic Organization
INSERT INTO organizations (id, name, slug, business_type, plan, plan_expires_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Flemela Bookstore',
  'flemela',
  'books',
  'lifetime',
  NULL
)
ON CONFLICT (slug) DO UPDATE SET
  business_type = 'books',
  plan = 'lifetime',
  updated_at = NOW();

-- 2. Deterministic Admin User (Password: AdminPassword123!)
INSERT INTO users (id, email, password_hash, name)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'admin@flemela.co.ke',
  crypt('AdminPassword123!', gen_salt('bf', 12)),
  'Flemela Store Administrator'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = crypt('AdminPassword123!', gen_salt('bf', 12)),
  updated_at = NOW();

-- 3. Owner Org Membership
INSERT INTO org_members (org_id, user_id, role)
SELECT 
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'owner'
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 4. Store Record
INSERT INTO stores (
  org_id, slug, name, description, location, delivery_info,
  status, hero_layout, hero_headline, hero_subheadline, hero_cta_label
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'flemela',
  'Flemela Bookstore',
  'Books that inspire. Knowledge that transforms.',
  'Sarit Centre, Westlands, Nairobi',
  'Free delivery across Nairobi on orders above KSh 2,500',
  'published',
  'editorial',
  'Books that change the way you think.',
  'Discover handpicked literature, timeless philosophy, and rigorous business knowledge. Instant digital downloads via Cloudflare R2 or authentic physical copies delivered to your doorstep.',
  'Explore Catalog'
)
ON CONFLICT (org_id) DO UPDATE SET
  slug = 'flemela',
  name = 'Flemela Bookstore',
  status = 'published',
  updated_at = NOW();

-- 5. Merchant Fulfillment Location Hub (Sarit Centre Hub)
INSERT INTO merchant_locations (
  org_id, name, lat, lng, address_text, max_delivery_radius_km, base_delivery_fee, fee_per_km
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Flemela Bookstore Main Hub',
  -1.268300,
  36.811100,
  'Sarit Centre Lower Level, Westlands, Nairobi',
  15.00,
  100.00,
  25.00
)
ON CONFLICT (org_id) DO UPDATE SET
  lat = -1.268300,
  lng = 36.811100,
  updated_at = NOW();

-- 6. Core Bookstore Categories
INSERT INTO categories (org_id, name)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Business & Finance'),
  ('a0000000-0000-0000-0000-000000000001', 'Psychology & Self-Help'),
  ('a0000000-0000-0000-0000-000000000001', 'Self-Help'),
  ('a0000000-0000-0000-0000-000000000001', 'Fiction & Literature'),
  ('a0000000-0000-0000-0000-000000000001', 'Christian Books'),
  ('a0000000-0000-0000-0000-000000000001', 'Education & Textbooks'),
  ('a0000000-0000-0000-0000-000000000001', 'Biographies & Memoir')
ON CONFLICT (org_id, name) DO NOTHING;