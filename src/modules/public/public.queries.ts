// =============================================================================
// soko-api/src/modules/public/public.queries.ts
// Strict Tenant-Isolated Public Storefront Queries
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

export interface PublicFormatRow {
  id: string;
  product_id: string;
  format: 'pdf' | 'epub' | 'hardcopy';
  price: string;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: string | null;
  stock: number | null;
}

export interface PublicProductRow {
  id: string;
  org_id: string;
  category_id: string;
  category_name: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  price: string;
  stock: number;
  images: Array<{ image_url: string; image_public_id: string; sort_order: number }>;
  formats: PublicFormatRow[];
  created_at: Date;
  updated_at: Date;
}

export interface PublicOrderItemRow {
  product_name: string;
  variant_title: string | null;
  unit_price: string;
  quantity: number;
  subtotal: string;
}

export interface PublicOrderDetailsRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: string;
  status: 'pending' | 'confirmed' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed';
  mpesa_receipt_number: string | null;
  checkout_request_id: string | null;
  delivery_type: 'delivery' | 'pickup';
  delivery_fee: string;
  delivery_fee_status: 'known' | 'needs_merchant_confirmation';
  delivery_confirmation_code: string | null;
  delivery_location: string;
}

export interface LocalEstateRow {
  id: string;
  name: string;
  city: string;
  lat: string;
  lng: string;
}

export async function searchEstatesLocal(searchQuery: string): Promise<LocalEstateRow[]> {
  const result = await query<LocalEstateRow>(
    `SELECT id, name, city, lat::text AS lat, lng::text AS lng
     FROM   estates
     WHERE  name ILIKE $1
        OR  EXISTS (
              SELECT 1 FROM unnest(area_alias) alias WHERE alias ILIKE $1
            )
     ORDER  BY (CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END), name ASC
     LIMIT  10`,
    [`%${searchQuery.trim()}%`]
  );
  return result.rows;
}

/**
 * Strict lookup by store slug. Never leaks other organization stores when not found.
 */
export async function getStoreBySlugPublic(slug: string): Promise<PublicStoreRow | null> {
  const cleanSlug = (slug || '').trim().toLowerCase();

  const result = await query<PublicStoreRow>(
    `SELECT s.id, s.org_id, s.slug, s.name, s.description, s.logo_url, s.cover_image_url,
            s.contact_phone, s.contact_email, s.location, s.delivery_info,
            s.hero_layout, s.hero_headline, s.hero_subheadline, s.hero_cta_label
     FROM   stores s
     INNER JOIN organizations o ON o.id = s.org_id
     WHERE  s.slug = $1
       AND  o.deleted_at IS NULL
       AND  s.status = 'published'
     LIMIT  1`,
    [cleanSlug]
  );

  return result.rows[0] ?? null;
}

/**
 * Returns products strictly isolated to the specified organization.
 */
export async function getProductsByStoreOrgIdPublic(orgId: string): Promise<PublicProductRow[]> {
  const result = await query<PublicProductRow>(
    `SELECT p.id,
            p.org_id,
            p.category_id,
            p.name,
            p.slug,
            p.sku,
            p.description,
            p.price::text AS price,
            COALESCE(c.name, 'General') AS category_name,
            COALESCE(i.stock, 0) AS stock,
            p.created_at,
            p.updated_at,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'image_url', pi.image_url,
                    'image_public_id', pi.image_public_id,
                    'sort_order', pi.sort_order
                  ) ORDER BY pi.sort_order ASC
                )
                FROM product_images pi
                WHERE pi.product_id = p.id
              ),
              '[]'::json
            ) AS images,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', pf.id,
                    'product_id', pf.product_id,
                    'format', pf.format,
                    'price', pf.price::text,
                    'file_url', pf.file_url,
                    'file_public_id', pf.file_public_id,
                    'file_size_bytes', pf.file_size_bytes::text,
                    'stock', pf.stock
                  ) ORDER BY (
                    CASE pf.format
                      WHEN 'hardcopy' THEN 1
                      WHEN 'pdf' THEN 2
                      WHEN 'epub' THEN 3
                      ELSE 4
                    END
                  ) ASC
                )
                FROM product_formats pf
                WHERE pf.product_id = p.id
              ),
              '[]'::json
            ) AS formats
     FROM   products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i  ON i.product_id = p.id
     WHERE  p.org_id     = $1
       AND  p.status     = 'published'
       AND  p.deleted_at IS NULL
     ORDER  BY p.created_at DESC`,
    [orgId]
  );
  return result.rows;
}

/**
 * Returns single product strictly isolated to the specified organization.
 */
export async function getProductBySlugPublic(
  orgId: string,
  productSlug: string
): Promise<PublicProductRow | null> {
  const result = await query<PublicProductRow>(
    `SELECT p.id,
            p.org_id,
            p.category_id,
            p.name,
            p.slug,
            p.sku,
            p.description,
            p.price::text AS price,
            COALESCE(c.name, 'General') AS category_name,
            COALESCE(i.stock, 0) AS stock,
            p.created_at,
            p.updated_at,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'image_url', pi.image_url,
                    'image_public_id', pi.image_public_id,
                    'sort_order', pi.sort_order
                  ) ORDER BY pi.sort_order ASC
                )
                FROM product_images pi
                WHERE pi.product_id = p.id
              ),
              '[]'::json
            ) AS images,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', pf.id,
                    'product_id', pf.product_id,
                    'format', pf.format,
                    'price', pf.price::text,
                    'file_url', pf.file_url,
                    'file_public_id', pf.file_public_id,
                    'file_size_bytes', pf.file_size_bytes::text,
                    'stock', pf.stock
                  ) ORDER BY (
                    CASE pf.format
                      WHEN 'hardcopy' THEN 1
                      WHEN 'pdf' THEN 2
                      WHEN 'epub' THEN 3
                      ELSE 4
                    END
                  ) ASC
                )
                FROM product_formats pf
                WHERE pf.product_id = p.id
              ),
              '[]'::json
            ) AS formats
     FROM   products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i  ON i.product_id = p.id
     WHERE  p.org_id     = $1
       AND  p.slug       = $2
       AND  p.status     = 'published'
       AND  p.deleted_at IS NULL`,
    [orgId, productSlug.trim().toLowerCase()]
  );
  return result.rows[0] ?? null;
}

export async function getPublicOrderDetailsRow(
  orgId: string,
  orderId: string
): Promise<PublicOrderDetailsRow | null> {
  const result = await query<PublicOrderDetailsRow>(
    `SELECT o.id, o.customer_name, o.customer_phone, o.total::text AS total, o.status,
            o.payment_method, o.payment_status,
            o.delivery_type, o.delivery_fee::text AS delivery_fee,
            o.delivery_fee_status, o.delivery_confirmation_code,
            o.delivery_location,
            mt.mpesa_receipt_number, mt.checkout_request_id
     FROM   orders o
     LEFT JOIN mpesa_transactions mt 
            ON mt.account_reference = o.id::text 
           AND mt.status = 'completed'
     WHERE  o.id = $1 AND o.org_id = $2
     ORDER BY mt.created_at DESC
     LIMIT 1`,
    [orderId, orgId]
  );
  return result.rows[0] ?? null;
}

export async function getPublicOrderItems(orderId: string): Promise<PublicOrderItemRow[]> {
  const result = await query<PublicOrderItemRow>(
    `SELECT product_name, variant_title, unit_price::text AS unit_price, quantity, subtotal::text AS subtotal
     FROM   order_items
     WHERE  order_id = $1`,
    [orderId]
  );
  return result.rows;
}