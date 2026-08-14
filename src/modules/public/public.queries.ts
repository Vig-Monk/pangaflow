// =============================================================================
// src/modules/public/public.queries.ts (STEP 5 FIX)
// =============================================================================

import { query } from '../../config/db';

export interface PublicStoreRow {
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
  hero_layout: string;
  hero_headline: string | null;
  hero_subheadline: string | null;
  hero_cta_label: string | null;
}

export interface PublicProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  category_name: string;
  stock: number;
  images: string[];
}

/**
 * Retrieves a published store record by its custom slug.
 * Returns null if the store is draft or suspended.
 */
export async function getStoreBySlugPublic(slug: string): Promise<PublicStoreRow | null> {
  const result = await query<PublicStoreRow>(
    `SELECT id, org_id, slug, name, description, logo_url, cover_image_url,
            contact_phone, contact_email, location, delivery_info,
            hero_layout, hero_headline, hero_subheadline, hero_cta_label
     FROM   stores
     WHERE  slug   = $1
       AND  status = 'published'`,
    [slug.trim().toLowerCase()]
  );
  return result.rows[0] ?? null;
}

/**
 * Retrieves all published products belonging to a store.
 */
export async function getProductsByStoreOrgIdPublic(orgId: string): Promise<PublicProductRow[]> {
  const result = await query<PublicProductRow>(
    `SELECT p.id, p.name, p.slug, p.description, p.price::text AS price,
            c.name AS category_name, i.stock,
            COALESCE(
              (
                SELECT json_agg(pi.image_url ORDER BY pi.sort_order ASC)
                FROM   product_images pi
                WHERE  pi.product_id = p.id
              ),
              '[]'::json
            ) AS images
     FROM   products p
     INNER  JOIN categories c ON c.id = p.category_id
     INNER  JOIN inventory i  ON i.product_id = p.id
     WHERE  p.org_id     = $1
       AND  p.status     = 'published'
       AND  p.deleted_at IS NULL
     ORDER  BY p.created_at DESC`,
    [orgId]
  );
  return result.rows;
}

/**
 * Retrieves a single published product record from a store.
 */
export async function getProductBySlugPublic(
  orgId: string,
  productSlug: string
): Promise<PublicProductRow | null> {
  const result = await query<PublicProductRow>(
    `SELECT p.id, p.name, p.slug, p.description, p.price::text AS price,
            c.name AS category_name, i.stock,
            COALESCE(
              (
                SELECT json_agg(pi.image_url ORDER BY pi.sort_order ASC)
                FROM   product_images pi
                WHERE  pi.product_id = p.id
              ),
              '[]'::json
            ) AS images
     FROM   products p
     INNER  JOIN categories c ON c.id = p.category_id
     INNER  JOIN inventory i  ON i.product_id = p.id
     WHERE  p.org_id     = $1
       AND  p.slug       = $2
       AND  p.status     = 'published'
       AND  p.deleted_at IS NULL`,
    [orgId, productSlug.trim().toLowerCase()]
  );
  return result.rows[0] ?? null;
}