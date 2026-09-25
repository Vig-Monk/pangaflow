// =============================================================================
// src/modules/stores/stores.queries.ts
// =============================================================================

import { query } from '../../config/db';

export interface PromoTickerItem {
  id: string;
  text: string;
  link?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface StoreHeroNotes {
  is_active: boolean;
  title: string;
  content_html: string;
  bg_color?: string;
  text_color?: string;
}

export interface Store {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  location: string | null;
  delivery_info: string | null;
  status: 'draft' | 'published' | 'suspended';
  hero_layout: string;
  hero_headline: string | null;
  hero_subheadline: string | null;
  hero_cta_label: string | null;
  promo_ticker: PromoTickerItem[];
  hero_notes: StoreHeroNotes;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertStoreInput {
  slug: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  location?: string | null;
  delivery_info?: string | null;
  status?: 'draft' | 'published' | 'suspended';
  hero_layout?: string;
  hero_headline?: string | null;
  hero_subheadline?: string | null;
  hero_cta_label?: string | null;
  promo_ticker?: PromoTickerItem[];
  hero_notes?: StoreHeroNotes;
}

export interface MerchantLocation {
  id: string;
  org_id: string;
  name: string;
  lat: number;
  lng: number;
  address_text: string | null;
  max_delivery_radius_km: number;
  base_delivery_fee: number;
  fee_per_km: number;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertMerchantLocationInput {
  name?: string;
  lat: number;
  lng: number;
  address_text?: string | null;
  max_delivery_radius_km?: number;
  base_delivery_fee?: number;
  fee_per_km?: number;
}

const DEFAULT_HERO_NOTES: StoreHeroNotes = {
  is_active: false,
  title: 'Reader Announcements',
  content_html: '<p>Welcome to <strong>The Sunrise Bookstore</strong>. Instant eBook downloads and physical deliveries across Nairobi.</p>',
  bg_color: '#FAF7F0',
  text_color: '#141E1A',
};

let tickerSchemaEnsured = false;
export async function ensureTickerSchema(): Promise<void> {
  if (tickerSchemaEnsured) return;
  try {
    await query(`
      ALTER TABLE stores
        ADD COLUMN IF NOT EXISTS promo_ticker JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    tickerSchemaEnsured = true;
  } catch {
    tickerSchemaEnsured = true;
  }
}

let heroNotesSchemaEnsured = false;
export async function ensureHeroNotesSchema(): Promise<void> {
  if (heroNotesSchemaEnsured) return;
  try {
    await query(`
      ALTER TABLE stores
        ADD COLUMN IF NOT EXISTS hero_notes JSONB NOT NULL DEFAULT '${JSON.stringify(DEFAULT_HERO_NOTES)}'::jsonb;
    `);
    heroNotesSchemaEnsured = true;
  } catch {
    heroNotesSchemaEnsured = true;
  }
}

export async function getStoreByOrgId(orgId: string): Promise<Store | null> {
  await ensureTickerSchema();
  await ensureHeroNotesSchema();

  const result = await query<Store>(
    `SELECT id, org_id, slug, name, description, logo_url, cover_image_url,
            contact_phone, contact_email, location, delivery_info, status,
            hero_layout, hero_headline, hero_subheadline, hero_cta_label,
            COALESCE(promo_ticker, '[]'::jsonb) AS promo_ticker,
            COALESCE(hero_notes, $2::jsonb) AS hero_notes,
            created_at, updated_at
     FROM   stores
     WHERE  org_id = $1`,
    [orgId, JSON.stringify(DEFAULT_HERO_NOTES)]
  );
  return result.rows[0] ?? null;
}

export async function checkSlugConflict(orgId: string, slug: string): Promise<boolean> {
  const result = await query<{ org_id: string }>(
    `SELECT org_id FROM stores WHERE slug = $1`,
    [slug.trim().toLowerCase()]
  );
  if (result.rows.length === 0) return false;
  return result.rows[0].org_id !== orgId;
}

export async function upsertStore(orgId: string, data: UpsertStoreInput): Promise<Store> {
  await ensureTickerSchema();
  await ensureHeroNotesSchema();

  const result = await query<Store>(
    `INSERT INTO stores (
       org_id, slug, name, description, logo_url, cover_image_url,
       contact_phone, contact_email, location, delivery_info, status,
       hero_layout, hero_headline, hero_subheadline, hero_cta_label,
       promo_ticker, hero_notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (org_id) DO UPDATE SET
       slug             = EXCLUDED.slug,
       name             = EXCLUDED.name,
       description      = EXCLUDED.description,
       logo_url         = EXCLUDED.logo_url,
       cover_image_url  = EXCLUDED.cover_image_url,
       contact_phone    = EXCLUDED.contact_phone,
       contact_email    = EXCLUDED.contact_email,
       location         = EXCLUDED.location,
       delivery_info    = EXCLUDED.delivery_info,
       status           = EXCLUDED.status,
       hero_layout      = EXCLUDED.hero_layout,
       hero_headline    = EXCLUDED.hero_headline,
       hero_subheadline = EXCLUDED.hero_subheadline,
       hero_cta_label   = EXCLUDED.hero_cta_label,
       promo_ticker     = COALESCE(EXCLUDED.promo_ticker, stores.promo_ticker),
       hero_notes       = COALESCE(EXCLUDED.hero_notes, stores.hero_notes),
       updated_at       = NOW()
     RETURNING 
       id, org_id, slug, name, description, logo_url, cover_image_url,
       contact_phone, contact_email, location, delivery_info, status,
       hero_layout, hero_headline, hero_subheadline, hero_cta_label,
       COALESCE(promo_ticker, '[]'::jsonb) AS promo_ticker,
       COALESCE(hero_notes, $17::jsonb) AS hero_notes,
       created_at, updated_at`,
    [
      orgId,
      data.slug.trim().toLowerCase(),
      data.name,
      data.description ?? null,
      data.logo_url ?? null,
      data.cover_image_url ?? null,
      data.contact_phone ?? null,
      data.contact_email ?? null,
      data.location ?? null,
      data.delivery_info ?? null,
      data.status ?? 'draft',
      data.hero_layout ?? 'editorial',
      data.hero_headline ?? null,
      data.hero_subheadline ?? null,
      data.hero_cta_label ?? null,
      JSON.stringify(data.promo_ticker ?? []),
      JSON.stringify(data.hero_notes ?? DEFAULT_HERO_NOTES),
    ]
  );
  return result.rows[0];
}

export async function getPromoTicker(orgId: string): Promise<PromoTickerItem[]> {
  await ensureTickerSchema();
  const result = await query<{ promo_ticker: PromoTickerItem[] }>(
    `SELECT COALESCE(promo_ticker, '[]'::jsonb) AS promo_ticker FROM stores WHERE org_id = $1`,
    [orgId]
  );
  return result.rows[0]?.promo_ticker || [];
}

export async function updatePromoTicker(orgId: string, items: PromoTickerItem[]): Promise<PromoTickerItem[]> {
  await ensureTickerSchema();
  const result = await query<{ promo_ticker: PromoTickerItem[] }>(
    `UPDATE stores
     SET promo_ticker = $2::jsonb, updated_at = NOW()
     WHERE org_id = $1
     RETURNING COALESCE(promo_ticker, '[]'::jsonb) AS promo_ticker`,
    [orgId, JSON.stringify(items)]
  );
  return result.rows[0]?.promo_ticker || [];
}

export async function getHeroNotes(orgId: string): Promise<StoreHeroNotes> {
  await ensureHeroNotesSchema();
  const result = await query<{ hero_notes: StoreHeroNotes }>(
    `SELECT COALESCE(hero_notes, $2::jsonb) AS hero_notes FROM stores WHERE org_id = $1`,
    [orgId, JSON.stringify(DEFAULT_HERO_NOTES)]
  );
  return result.rows[0]?.hero_notes || DEFAULT_HERO_NOTES;
}

export async function updateHeroNotes(orgId: string, notes: StoreHeroNotes): Promise<StoreHeroNotes> {
  await ensureHeroNotesSchema();
  const result = await query<{ hero_notes: StoreHeroNotes }>(
    `UPDATE stores
     SET hero_notes = $2::jsonb, updated_at = NOW()
     WHERE org_id = $1
     RETURNING COALESCE(hero_notes, $2::jsonb) AS hero_notes`,
    [orgId, JSON.stringify(notes)]
  );
  return result.rows[0]?.hero_notes || DEFAULT_HERO_NOTES;
}

// ---------------------------------------------------------------------------
// Merchant Fulfillment Location Hub Queries
// ---------------------------------------------------------------------------

export async function getMerchantLocation(orgId: string): Promise<MerchantLocation | null> {
  const result = await query<{
    id: string;
    org_id: string;
    name: string;
    lat: string;
    lng: string;
    address_text: string | null;
    max_delivery_radius_km: string;
    base_delivery_fee: string;
    fee_per_km: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, org_id, name, lat::text AS lat, lng::text AS lng, address_text,
            max_delivery_radius_km::text AS max_delivery_radius_km,
            base_delivery_fee::text AS base_delivery_fee,
            fee_per_km::text AS fee_per_km,
            created_at, updated_at
     FROM   merchant_locations
     WHERE  org_id = $1`,
    [orgId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lng),
    address_text: row.address_text,
    max_delivery_radius_km: parseFloat(row.max_delivery_radius_km),
    base_delivery_fee: parseFloat(row.base_delivery_fee),
    fee_per_km: parseFloat(row.fee_per_km),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function upsertMerchantLocation(
  orgId: string,
  data: UpsertMerchantLocationInput
): Promise<MerchantLocation> {
  const result = await query<{
    id: string;
    org_id: string;
    name: string;
    lat: string;
    lng: string;
    address_text: string | null;
    max_delivery_radius_km: string;
    base_delivery_fee: string;
    fee_per_km: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO merchant_locations (
       org_id, name, lat, lng, address_text,
       max_delivery_radius_km, base_delivery_fee, fee_per_km
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (org_id) DO UPDATE SET
       name                   = EXCLUDED.name,
       lat                    = EXCLUDED.lat,
       lng                    = EXCLUDED.lng,
       address_text           = EXCLUDED.address_text,
       max_delivery_radius_km = EXCLUDED.max_delivery_radius_km,
       base_delivery_fee      = EXCLUDED.base_delivery_fee,
       fee_per_km             = EXCLUDED.fee_per_km,
       updated_at             = NOW()
     RETURNING id, org_id, name, lat::text AS lat, lng::text AS lng, address_text,
               max_delivery_radius_km::text AS max_delivery_radius_km,
               base_delivery_fee::text AS base_delivery_fee,
               fee_per_km::text AS fee_per_km,
               created_at, updated_at`,
    [
      orgId,
      data.name ?? 'Main Store / Hub',
      data.lat,
      data.lng,
      data.address_text ?? null,
      data.max_delivery_radius_km ?? 15,
      data.base_delivery_fee ?? 100,
      data.fee_per_km ?? 25,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lng),
    address_text: row.address_text,
    max_delivery_radius_km: parseFloat(row.max_delivery_radius_km),
    base_delivery_fee: parseFloat(row.base_delivery_fee),
    fee_per_km: parseFloat(row.fee_per_km),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}