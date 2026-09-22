// =============================================================================
// soko-api/src/modules/public/public.queries.ts
// Strict Tenant-Isolated Public Storefront Queries with Shared Catalog Support
// =============================================================================

import { query } from '../../config/db';
import { buildFuzzySearchQuery } from '../../utils/search';

export interface PublicStoreRow {
  id: string;
  org_id: string;
  catalog_source_org_id: string | null;
  digital_only: boolean;
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
  promo_ticker: Array<{
    id: string;
    text: string;
    link?: string | null;
    is_active: boolean;
    sort_order: number;
  }>;
}

export interface PublicFormatRow {
  id: string;
  product_id: string;
  format: 'pdf' | 'epub' | 'hardcopy';
  price: string;
  compare_at_price: string | null;
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
  compare_at_price: string | null;
  badge: string | null;
  sale_ends_at: Date | null;
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
  customer_email: string | null;
  total: string;
  status: 'pending' | 'confirmed' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_reference: string | null;
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

export interface ListStoreProductsOptions {
  searchQuery?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPublicProducts {
  products: PublicProductRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
 * Retrieves public store metadata, including the shared catalog link and channel rules.
 */
export async function getStoreBySlugPublic(slug: string): Promise<PublicStoreRow | null> {
  const cleanSlug = (slug || '').trim().toLowerCase();

  const result = await query<PublicStoreRow>(
    `SELECT s.id,
            s.org_id,
            o.catalog_source_org_id,
            COALESCE((o.settings->>'digital_only')::boolean, false) AS digital_only,
            s.slug,
            s.name,
            s.description,
            s.logo_url,
            s.cover_image_url,
            s.contact_phone,
            s.contact_email,
            s.location,
            s.delivery_info,
            s.hero_layout,
            s.hero_headline,
            s.hero_subheadline,
            s.hero_cta_label,
            COALESCE(s.promo_ticker, '[]'::jsonb) AS promo_ticker
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
 * Queries catalog items for a given storefront channel.
 * Resolves against effectiveCatalogOrgId (shared master catalog or local tenant).
 * Automatically applies channel format filtering (e.g. digital-only for EbookReads).
 */
export async function getProductsByStoreOrgIdPublic(
  catalogOrgId: string,
  options: ListStoreProductsOptions = {},
  digitalOnly = false
): Promise<PaginatedPublicProducts> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = [
    'p.org_id = $1',
    "p.status = 'published'",
    'p.deleted_at IS NULL',
  ];
  const params: unknown[] = [catalogOrgId];
  let paramIndex = 2;

  // 1. Digital-Only Channel Filter (EbookReads restriction)
  if (digitalOnly) {
    conditions.push(`EXISTS (
      SELECT 1 FROM product_formats pf_filter
      WHERE pf_filter.product_id = p.id
        AND pf_filter.format IN ('pdf', 'epub')
    )`);
  }

  // 2. Category Filter
  if (
    options.category &&
    !['general', 'all', 'all books'].includes(options.category.toLowerCase().trim())
  ) {
    const cleanCat = options.category.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCat)) {
      conditions.push(`p.category_id = $${paramIndex}`);
      params.push(cleanCat);
      paramIndex++;
    } else {
      conditions.push(`(
        LOWER(TRIM(c.name)) = LOWER(TRIM($${paramIndex})) OR
        c.slug = LOWER(TRIM($${paramIndex})) OR
        c.name ILIKE $${paramIndex + 1}
      )`);
      params.push(cleanCat, `%${cleanCat}%`);
      paramIndex += 2;
    }
  }

  // 3. Typo-Tolerant Trigram Matcher
  let relevanceOrderClause = 'p.created_at DESC';

  if (options.searchQuery && options.searchQuery.trim().length > 0) {
    const fuzzy = buildFuzzySearchQuery({
      searchTerm: options.searchQuery,
      startParamIndex: paramIndex,
      similarityThreshold: 0.28,
      fields: [
        { column: 'p.name', weight: 1.8 },
        { column: 'p.sku', weight: 1.3, exactOnly: false },
        { column: 'p.description', weight: 0.8 },
        { column: 'c.name', weight: 0.7 },
      ],
    });

    if (fuzzy) {
      conditions.push(fuzzy.conditionSql);
      params.push(...fuzzy.params);
      paramIndex = fuzzy.nextParamIndex;
      relevanceOrderClause = `${fuzzy.relevanceSql} DESC, p.created_at DESC`;
    }
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(p.id) AS count
     FROM   products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE  ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (total === 0) {
    return {
      products: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }

  const formatFilterClause = digitalOnly
    ? "AND pf.format IN ('pdf', 'epub')"
    : '';

  const dataParams = [...params, limit, offset];
  const dataResult = await query<PublicProductRow>(
    `SELECT p.id,
            p.org_id,
            p.category_id,
            p.name,
            p.slug,
            p.sku,
            p.description,
            p.price::text AS price,
            p.compare_at_price::text AS compare_at_price,
            p.badge,
            p.sale_ends_at,
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
                    'compare_at_price', pf.compare_at_price::text,
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
                ${formatFilterClause}
              ),
              '[]'::json
            ) AS formats
     FROM   products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i  ON i.product_id = p.id
     WHERE  ${whereClause}
     ORDER  BY ${relevanceOrderClause}
     LIMIT  $${paramIndex} OFFSET $${paramIndex + 1}`,
    dataParams
  );

  return {
    products: dataResult.rows,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Retrieves a single book by slug against the effective catalog source.
 */
export async function getProductBySlugPublic(
  catalogOrgId: string,
  productSlug: string,
  digitalOnly = false
): Promise<PublicProductRow | null> {
  const formatFilterClause = digitalOnly
    ? "AND pf.format IN ('pdf', 'epub')"
    : '';

  const result = await query<PublicProductRow>(
    `SELECT p.id,
            p.org_id,
            p.category_id,
            p.name,
            p.slug,
            p.sku,
            p.description,
            p.price::text AS price,
            p.compare_at_price::text AS compare_at_price,
            p.badge,
            p.sale_ends_at,
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
                    'compare_at_price', pf.compare_at_price::text,
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
                ${formatFilterClause}
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
    [catalogOrgId, productSlug.trim().toLowerCase()]
  );
  return result.rows[0] ?? null;
}

export async function getPublicOrderDetailsRow(
  orgId: string,
  orderId: string
): Promise<PublicOrderDetailsRow | null> {
  const result = await query<PublicOrderDetailsRow>(
    `SELECT o.id, o.customer_name, o.customer_phone, o.customer_email,
            o.total::text AS total, o.status,
            o.payment_method, o.payment_status, o.payment_reference,
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