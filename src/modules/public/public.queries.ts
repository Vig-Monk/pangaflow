// =============================================================================
// src/modules/public/public.queries.ts
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

export interface PublicOrderItemRow {
  product_name: string;
  unit_price: string;
  quantity: number;
  subtotal: string;
}

export interface PublicOrderDetailsRow {
  id: string;
  customer_name: string;
  total: string;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed';
  mpesa_receipt_number: string | null;
  checkout_request_id: string | null;
}

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

export async function getProductsByStoreOrgIdPublic(orgId: string): Promise<PublicProductRow[]> {
  const result = await query<PublicProductRow>(
    `SELECT p.id, p.name, p.slug, p.description, p.price::text AS price,
            COALESCE(c.name, 'General') AS category_name, COALESCE(i.stock, 0) AS stock,
            COALESCE(
              (
                SELECT json_agg(pi.image_url ORDER BY pi.sort_order ASC)
                FROM   product_images pi
                WHERE  pi.product_id = p.id
              ),
              '[]'::json
            ) AS images
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

export async function getProductBySlugPublic(
  orgId: string,
  productSlug: string
): Promise<PublicProductRow | null> {
  const result = await query<PublicProductRow>(
    `SELECT p.id, p.name, p.slug, p.description, p.price::text AS price,
            COALESCE(c.name, 'General') AS category_name, COALESCE(i.stock, 0) AS stock,
            COALESCE(
              (
                SELECT json_agg(pi.image_url ORDER BY pi.sort_order ASC)
                FROM   product_images pi
                WHERE  pi.product_id = p.id
              ),
              '[]'::json
            ) AS images
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
    `SELECT o.id, o.customer_name, o.total::text AS total, o.status,
            o.payment_method, o.payment_status,
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
    `SELECT product_name, unit_price::text AS unit_price, quantity, subtotal::text AS subtotal
     FROM   order_items
     WHERE  order_id = $1`,
    [orderId]
  );
  return result.rows;
}