// =============================================================================
// soko-api/src/modules/banners/banners.service.ts
// Business logic for customizable promotional hero banners.
// =============================================================================

import { z } from 'zod';
import { AppError } from '../../utils/error';
import * as bannersQueries from './banners.queries';
import type { StoreBannerRow } from './banners.queries';

export const CreateBannerSchema = z
  .object({
    title: z
      .string()
      .max(200)
      .trim()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    subtitle: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    badge: z
      .string()
      .max(50)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    image_url: z.string().url('A valid desktop image URL is required'),
    mobile_image_url: z
      .string()
      .url('Invalid mobile image URL')
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    cta_label: z
      .string()
      .max(50)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    cta_link: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    bg_color: z
      .string()
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color code')
      .default('#052219'),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().default(true),
    starts_at: z.string().datetime().nullable().optional(),
    ends_at: z.string().datetime().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.starts_at && data.ends_at) {
        return new Date(data.ends_at).getTime() > new Date(data.starts_at).getTime();
      }
      return true;
    },
    {
      message: 'Expiration date must be strictly after the start date',
      path: ['ends_at'],
    }
  );

export const UpdateBannerSchema = z
  .object({
    title: z
      .string()
      .max(200)
      .trim()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    subtitle: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    badge: z
      .string()
      .max(50)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    image_url: z.string().url().optional(),
    mobile_image_url: z
      .string()
      .url()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    cta_label: z
      .string()
      .max(50)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    cta_link: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v)),
    bg_color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
    starts_at: z.string().datetime().nullable().optional(),
    ends_at: z.string().datetime().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.starts_at && data.ends_at) {
        return new Date(data.ends_at).getTime() > new Date(data.starts_at).getTime();
      }
      return true;
    },
    {
      message: 'Expiration date must be strictly after the start date',
      path: ['ends_at'],
    }
  );

export const ReorderBannersSchema = z.object({
  bannerIds: z.array(z.string().uuid()).min(1, 'At least one banner ID is required to reorder'),
});

export interface StoreBannerDto {
  id: string;
  org_id: string;
  title: string | null;
  subtitle: string | null;
  badge: string | null;
  image_url: string;
  mobile_image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
  bg_color: string;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export function toBannerDto(row: StoreBannerRow): StoreBannerDto {
  return {
    id: row.id,
    org_id: row.org_id,
    title: row.title || null,
    subtitle: row.subtitle,
    badge: row.badge,
    image_url: row.image_url,
    mobile_image_url: row.mobile_image_url,
    cta_label: row.cta_label || null,
    cta_link: row.cta_link || null,
    bg_color: row.bg_color,
    sort_order: row.sort_order,
    is_active: row.is_active,
    starts_at: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    ends_at: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    click_count: row.click_count,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export async function getAdminBanners(orgId: string): Promise<StoreBannerDto[]> {
  const rows = await bannersQueries.listBannersAdmin(orgId);
  return rows.map(toBannerDto);
}

export async function getPublicActiveBanners(orgId: string): Promise<StoreBannerDto[]> {
  const rows = await bannersQueries.listActiveBannersPublic(orgId);
  return rows.map(toBannerDto);
}

export async function createBanner(orgId: string, rawBody: unknown): Promise<StoreBannerDto> {
  const parsed = CreateBannerSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid banner payload', 400);
  }

  const row = await bannersQueries.createBanner(orgId, {
    ...parsed.data,
    title: parsed.data.title || null,
    starts_at: parsed.data.starts_at ? new Date(parsed.data.starts_at) : null,
    ends_at: parsed.data.ends_at ? new Date(parsed.data.ends_at) : null,
  });

  return toBannerDto(row);
}

export async function updateBanner(
  orgId: string,
  bannerId: string,
  rawBody: unknown
): Promise<StoreBannerDto> {
  const existing = await bannersQueries.getBannerById(orgId, bannerId);
  if (!existing) {
    throw new AppError('Banner not found', 404);
  }

  const parsed = UpdateBannerSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid banner update payload', 400);
  }

  const row = await bannersQueries.updateBanner(orgId, bannerId, {
    ...parsed.data,
    starts_at:
      parsed.data.starts_at !== undefined
        ? parsed.data.starts_at
          ? new Date(parsed.data.starts_at)
          : null
        : undefined,
    ends_at:
      parsed.data.ends_at !== undefined
        ? parsed.data.ends_at
          ? new Date(parsed.data.ends_at)
          : null
        : undefined,
  });

  if (!row) {
    throw new AppError('Banner not found', 404);
  }

  return toBannerDto(row);
}

export async function deleteBanner(orgId: string, bannerId: string): Promise<void> {
  const deleted = await bannersQueries.deleteBanner(orgId, bannerId);
  if (!deleted) {
    throw new AppError('Banner not found', 404);
  }
}

export async function reorderBanners(orgId: string, rawBody: unknown): Promise<void> {
  const parsed = ReorderBannersSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid reordering payload', 400);
  }

  await bannersQueries.reorderBannersTransactional(orgId, parsed.data.bannerIds);
}

export async function recordClick(bannerId: string): Promise<void> {
  await bannersQueries.trackBannerClick(bannerId);
}