-- =============================================================================
-- Migration: 030_seed_ebookreads.sql
-- Soko Platform — Idempotent Seed for EbookReads Flagship Storefront
-- =============================================================================
-- Guaranteed multi-tenant isolation:
-- 1. All records strictly bind to deterministic ID: a0000000-0000-0000-0000-000000000002.
-- 2. ZERO unbound UPDATE statements (protects Flemela and all other tenants).
-- 3. Idempotent: safe to run multiple times without duplicating rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Deterministic Organization Record
-- ---------------------------------------------------------------------------
INSERT INTO organizations (
  id,
  name,
  slug,
  business_type,
  plan,
  plan_expires_at,
  settings
)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'EbookReads',
  'ebookreads',
  'books',
  'lifetime',
  NULL,
  '{"currency": "KES", "primary_color": "#E50914", "dark_color": "#111315"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name          = 'EbookReads',
  business_type = 'books',
  plan          = 'lifetime',
  settings      = '{"currency": "KES", "primary_color": "#E50914", "dark_color": "#111315"}'::jsonb,
  deleted_at    = NULL,
  updated_at    = NOW();

-- ---------------------------------------------------------------------------
-- 2. Deterministic Admin User (Default Password: AdminPassword123!)
-- ---------------------------------------------------------------------------
INSERT INTO users (
  id,
  email,
  password_hash,
  name
)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'admin@ebookreads.co.ke',
  crypt('AdminPassword123!', gen_salt('bf', 12)),
  'EbookReads Administrator'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = crypt('AdminPassword123!', gen_salt('bf', 12)),
  deleted_at    = NULL,
  updated_at    = NOW();

-- ---------------------------------------------------------------------------
-- 3. Owner Org Membership Link
-- ---------------------------------------------------------------------------
INSERT INTO org_members (
  org_id,
  user_id,
  role
)
SELECT 
  'a0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  'owner'
ON CONFLICT (org_id, user_id) DO UPDATE SET
  role = 'owner';

-- ---------------------------------------------------------------------------
-- 4. Storefront Configuration Record
-- ---------------------------------------------------------------------------
INSERT INTO stores (
  org_id,
  slug,
  name,
  description,
  location,
  delivery_info,
  status,
  hero_layout,
  hero_headline,
  hero_subheadline,
  hero_cta_label,
  promo_ticker
)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'ebookreads',
  'EbookReads',
  'Discover Your Next Great Book. Instant digital downloads and curated reading collections.',
  'Diamond Mall / Diamond Plaza, 4th Parklands Ave, Nairobi',
  'Instant PDF digital download links delivered directly to your device upon M-Pesa payment.',
  'published',
  'editorial',
  'Discover Your Next Great Book',
  'Thousands of ebooks. Endless possibilities. Read, learn, and grow — all in one place.',
  'Browse Ebooks',
  '[
    {"id": "ticker-1", "text": "Get 50% OFF on all ebooks this weekend only!", "link": "#catalog-results", "is_active": true, "sort_order": 0},
    {"id": "ticker-2", "text": "Instant PDF download delivered directly to your device upon payment", "link": "#catalog-results", "is_active": true, "sort_order": 1},
    {"id": "ticker-3", "text": "Need a specific title? Custom book requests fulfilled on WhatsApp", "link": "https://wa.me/254143304460", "is_active": true, "sort_order": 2}
  ]'::jsonb
)
ON CONFLICT (org_id) DO UPDATE SET
  slug             = 'ebookreads',
  name             = 'EbookReads',
  description      = 'Discover Your Next Great Book. Instant digital downloads and curated reading collections.',
  location         = 'Diamond Mall / Diamond Plaza, 4th Parklands Ave, Nairobi',
  delivery_info    = 'Instant PDF digital download links delivered directly to your device upon M-Pesa payment.',
  status           = 'published',
  hero_headline    = 'Discover Your Next Great Book',
  hero_subheadline = 'Thousands of ebooks. Endless possibilities. Read, learn, and grow — all in one place.',
  hero_cta_label   = 'Browse Ebooks',
  updated_at       = NOW();

-- ---------------------------------------------------------------------------
-- 5. Merchant Fulfillment Location Hub (Diamond Mall Base)
-- ---------------------------------------------------------------------------
INSERT INTO merchant_locations (
  org_id,
  name,
  lat,
  lng,
  address_text,
  max_delivery_radius_km,
  base_delivery_fee,
  fee_per_km
)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'EbookReads Main Hub (Diamond Mall)',
  -1.261200,
  36.816700,
  'Diamond Mall / Diamond Plaza, 4th Parklands Ave, Nairobi',
  15.00,
  100.00,
  25.00
)
ON CONFLICT (org_id) DO UPDATE SET
  name                   = 'EbookReads Main Hub (Diamond Mall)',
  lat                    = -1.261200,
  lng                    = 36.816700,
  address_text           = 'Diamond Mall / Diamond Plaza, 4th Parklands Ave, Nairobi',
  max_delivery_radius_km = 15.00,
  base_delivery_fee      = 100.00,
  fee_per_km             = 25.00,
  updated_at             = NOW();

-- ---------------------------------------------------------------------------
-- 6. Canonical Bookstore Categories for EbookReads
-- ---------------------------------------------------------------------------
INSERT INTO categories (
  org_id,
  name,
  slug,
  description,
  is_featured,
  sort_order
)
VALUES 
  ('a0000000-0000-0000-0000-000000000002', 'Fiction', 'fiction', 'Sci-Fi, Dystopian, Classics & Thrillers', true, 1),
  ('a0000000-0000-0000-0000-000000000002', 'Non-Fiction', 'non-fiction', 'Biographies, Memoirs, History & Science', true, 2),
  ('a0000000-0000-0000-0000-000000000002', 'Self Help', 'self-help', 'Habits, Psychology, Mastery & Focus', true, 3),
  ('a0000000-0000-0000-0000-000000000002', 'Business', 'business', 'Money, Power, Investing & Freedom', true, 4),
  ('a0000000-0000-0000-0000-000000000002', 'Technology', 'technology', 'Programming, AI, Engineering & Systems', true, 5),
  ('a0000000-0000-0000-0000-000000000002', 'Classic', 'classic', 'Timeless Literature & Literary Masterpieces', true, 6),
  ('a0000000-0000-0000-0000-000000000002', 'General', 'general', 'General Collection', false, 7)
ON CONFLICT (org_id, LOWER(TRIM(name))) DO UPDATE SET
  slug        = EXCLUDED.slug,
  description = EXCLUDED.description,
  is_featured = EXCLUDED.is_featured,
  sort_order  = EXCLUDED.sort_order;