// =============================================================================
// src/modules/stores/stores.queries.ts (UPDATED)
// =============================================================================

import { query } from '../../config/db';

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
}

export async function getStoreByOrgId(orgId: string): Promise<Store | null> {
  const result = await query<Store>(
    `SELECT id, org_id, slug, name, description, logo_url, cover_image_url,
            contact_phone, contact_email, location, delivery_info, status,
            hero_layout, hero_headline, hero_subheadline, hero_cta_label,
            created_at, updated_at
     FROM   stores
     WHERE  org_id = $1`,
    [orgId]
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
  const result = await query<Store>(
    `INSERT INTO stores (
       org_id, slug, name, description, logo_url, cover_image_url,
       contact_phone, contact_email, location, delivery_info, status,
       hero_layout, hero_headline, hero_subheadline, hero_cta_label
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (org_id) DO UPDATE SET
       slug            = EXCLUDED.slug,
       name            = EXCLUDED.name,
       description     = EXCLUDED.description,
       logo_url        = EXCLUDED.logo_url,
       cover_image_url = EXCLUDED.cover_image_url,
       contact_phone   = EXCLUDED.contact_phone,
       contact_email   = EXCLUDED.contact_email,
       location        = EXCLUDED.location,
       delivery_info   = EXCLUDED.delivery_info,
       status          = EXCLUDED.status,
       hero_layout     = EXCLUDED.hero_layout,
       hero_headline   = EXCLUDED.hero_headline,
       hero_subheadline = EXCLUDED.hero_subheadline,
       hero_cta_label  = EXCLUDED.hero_cta_label,
       updated_at      = NOW()
     RETURNING 
       id, org_id, slug, name, description, logo_url, cover_image_url,
       contact_phone, contact_email, location, delivery_info, status,
       hero_layout, hero_headline, hero_subheadline, hero_cta_label,
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
    ]
  );
  return result.rows[0];
}