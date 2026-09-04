// =============================================================================
// soko-api/src/modules/banners/banners.queries.ts
// Database access layer for store promotional hero banners.
// =============================================================================

import { query, pool } from '../../config/db';

export interface StoreBannerRow {
  id: string;
  org_id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image_url: string;
  mobile_image_url: string | null;
  cta_label: string;
  cta_link: string;
  bg_color: string;
  sort_order: number;
  is_active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  click_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBannerInput {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  image_url: string;
  mobile_image_url?: string | null;
  cta_label?: string;
  cta_link?: string;
  bg_color?: string;
  sort_order?: number;
  is_active?: boolean;
  starts_at?: Date | null;
  ends_at?: Date | null;
}

export interface UpdateBannerInput {
  title?: string;
  subtitle?: string | null;
  badge?: string | null;
  image_url?: string;
  mobile_image_url?: string | null;
  cta_label?: string;
  cta_link?: string;
  bg_color?: string;
  sort_order?: number;
  is_active?: boolean;
  starts_at?: Date | null;
  ends_at?: Date | null;
}

const BANNER_SELECT_FIELDS = `
  id, org_id, title, subtitle, badge, image_url, mobile_image_url,
  cta_label, cta_link, bg_color, sort_order, is_active,
  starts_at, ends_at, click_count, created_at, updated_at
`;

export async function listBannersAdmin(orgId: string): Promise<StoreBannerRow[]> {
  const result = await query<StoreBannerRow>(
    `SELECT ${BANNER_SELECT_FIELDS}
     FROM   store_banners
     WHERE  org_id = $1
     ORDER  BY sort_order ASC, created_at DESC`,
    [orgId]
  );
  return result.rows;
}

export async function listActiveBannersPublic(orgId: string): Promise<StoreBannerRow[]> {
  const result = await query<StoreBannerRow>(
    `SELECT ${BANNER_SELECT_FIELDS}
     FROM   store_banners
     WHERE  org_id = $1
       AND  is_active = TRUE
       AND  (starts_at IS NULL OR starts_at <= NOW())
       AND  (ends_at IS NULL OR ends_at > NOW())
     ORDER  BY sort_order ASC, created_at DESC`,
    [orgId]
  );
  return result.rows;
}

export async function getBannerById(orgId: string, bannerId: string): Promise<StoreBannerRow | null> {
  const result = await query<StoreBannerRow>(
    `SELECT ${BANNER_SELECT_FIELDS}
     FROM   store_banners
     WHERE  org_id = $1 AND id = $2`,
    [orgId, bannerId]
  );
  return result.rows[0] ?? null;
}

export async function createBanner(
  orgId: string,
  data: CreateBannerInput
): Promise<StoreBannerRow> {
  // If sort_order is not passed, default to highest + 1
  let nextSortOrder = data.sort_order;
  if (nextSortOrder === undefined) {
    const maxSortResult = await query<{ max_sort: number | null }>(
      `SELECT MAX(sort_order) AS max_sort FROM store_banners WHERE org_id = $1`,
      [orgId]
    );
    nextSortOrder = (maxSortResult.rows[0]?.max_sort ?? -1) + 1;
  }

  const result = await query<StoreBannerRow>(
    `INSERT INTO store_banners (
       org_id, title, subtitle, badge, image_url, mobile_image_url,
       cta_label, cta_link, bg_color, sort_order, is_active, starts_at, ends_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${BANNER_SELECT_FIELDS}`,
    [
      orgId,
      data.title.trim(),
      data.subtitle?.trim() || null,
      data.badge?.trim().toUpperCase() || null,
      data.image_url.trim(),
      data.mobile_image_url?.trim() || null,
      data.cta_label?.trim() || 'Explore',
      data.cta_link?.trim() || '/#catalog-results',
      data.bg_color?.trim() || '#052219',
      nextSortOrder,
      data.is_active ?? true,
      data.starts_at ?? null,
      data.ends_at ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateBanner(
  orgId: string,
  bannerId: string,
  data: UpdateBannerInput
): Promise<StoreBannerRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [orgId, bannerId];
  let paramIdx = 3;

  if (data.title !== undefined) {
    setClauses.push(`title = $${paramIdx}`);
    params.push(data.title.trim());
    paramIdx++;
  }
  if (data.subtitle !== undefined) {
    setClauses.push(`subtitle = $${paramIdx}`);
    params.push(data.subtitle?.trim() || null);
    paramIdx++;
  }
  if (data.badge !== undefined) {
    setClauses.push(`badge = $${paramIdx}`);
    params.push(data.badge?.trim().toUpperCase() || null);
    paramIdx++;
  }
  if (data.image_url !== undefined) {
    setClauses.push(`image_url = $${paramIdx}`);
    params.push(data.image_url.trim());
    paramIdx++;
  }
  if (data.mobile_image_url !== undefined) {
    setClauses.push(`mobile_image_url = $${paramIdx}`);
    params.push(data.mobile_image_url?.trim() || null);
    paramIdx++;
  }
  if (data.cta_label !== undefined) {
    setClauses.push(`cta_label = $${paramIdx}`);
    params.push(data.cta_label.trim());
    paramIdx++;
  }
  if (data.cta_link !== undefined) {
    setClauses.push(`cta_link = $${paramIdx}`);
    params.push(data.cta_link.trim());
    paramIdx++;
  }
  if (data.bg_color !== undefined) {
    setClauses.push(`bg_color = $${paramIdx}`);
    params.push(data.bg_color.trim());
    paramIdx++;
  }
  if (data.sort_order !== undefined) {
    setClauses.push(`sort_order = $${paramIdx}`);
    params.push(data.sort_order);
    paramIdx++;
  }
  if (data.is_active !== undefined) {
    setClauses.push(`is_active = $${paramIdx}`);
    params.push(data.is_active);
    paramIdx++;
  }
  if (data.starts_at !== undefined) {
    setClauses.push(`starts_at = $${paramIdx}`);
    params.push(data.starts_at);
    paramIdx++;
  }
  if (data.ends_at !== undefined) {
    setClauses.push(`ends_at = $${paramIdx}`);
    params.push(data.ends_at);
    paramIdx++;
  }

  if (setClauses.length === 0) {
    return getBannerById(orgId, bannerId);
  }

  setClauses.push('updated_at = NOW()');

  const result = await query<StoreBannerRow>(
    `UPDATE store_banners
     SET    ${setClauses.join(', ')}
     WHERE  org_id = $1 AND id = $2
     RETURNING ${BANNER_SELECT_FIELDS}`,
    params
  );
  return result.rows[0] ?? null;
}

export async function deleteBanner(orgId: string, bannerId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM store_banners WHERE org_id = $1 AND id = $2`,
    [orgId, bannerId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function reorderBannersTransactional(
  orgId: string,
  bannerIdsInOrder: string[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < bannerIdsInOrder.length; i++) {
      await client.query(
        `UPDATE store_banners
         SET    sort_order = $3, updated_at = NOW()
         WHERE  org_id = $1 AND id = $2`,
        [orgId, bannerIdsInOrder[i], i]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function trackBannerClick(bannerId: string): Promise<void> {
  await query(
    `UPDATE store_banners
     SET    click_count = click_count + 1
     WHERE  id = $1`,
    [bannerId]
  );
}