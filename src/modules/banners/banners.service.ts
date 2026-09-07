// =============================================================================
// soko-api/src/modules/banners/banners.service.ts
// Business logic for customizable promotional hero banners.
// =============================================================================

import { z } from 'zod';
import { AppError } from '../../utils/error';
import * as bannersQueries from './banners.queries';
import type { StoreBannerRow } from './banners.queries';

function cleanUrl(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export const CreateBannerSchema = z
  .object({
    title: z
      .string()
      .max(200)
      .trim()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    subtitle: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    badge: z
      .string()
      .max(50)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim().toUpperCase() : null)),
    image_url: z
      .string()
      .trim()
      .min(1, 'Desktop banner image is required')
      .transform(cleanUrl)
      .refine((v): v is string => Boolean(v && v.length > 3), {
        message: 'A valid desktop image URL is required',
      }),
    mobile_image_url: z
      .string()
      .trim()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform(cleanUrl),
    cta_label: z
      .string()
      .max(50)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    cta_link: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    bg_color: z
      .string()
      .trim()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : '#052219')),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().default(true),
    starts_at: z
      .string()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => {
        if (!v || !v.trim()) return null;
        const d = new Date(v.trim());
        return isNaN(d.getTime()) ? null : d.toISOString();
      }),
    ends_at: z
      .string()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => {
        if (!v || !v.trim()) return null;
        const d = new Date(v.trim());
        return isNaN(d.getTime()) ? null : d.toISOString();
      }),
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
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    subtitle: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    badge: z
      .string()
      .max(50)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim().toUpperCase() : null)),
    image_url: z
      .string()
      .trim()
      .optional()
      .or(z.literal(''))
      .transform((v): string | undefined => (v && v.trim() ? cleanUrl(v) ?? undefined : undefined))
      .refine((v): v is string | undefined => v === undefined || (typeof v === 'string' && v.length > 3), {
        message: 'A valid desktop image URL is required',
      }),
    mobile_image_url: z
      .string()
      .trim()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform(cleanUrl),
    cta_label: z
      .string()
      .max(50)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    cta_link: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    bg_color: z
      .string()
      .trim()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : '#052219')),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
    starts_at: z
      .string()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => {
        if (!v || !v.trim()) return null;
        const d = new Date(v.trim());
        return isNaN(d.getTime()) ? null : d.toISOString();
      }),
    ends_at: z
      .string()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => {
        if (!v || !v.trim()) return null;
        const d = new Date(v.trim());
        return isNaN(d.getTime()) ? null : d.toISOString();
      }),
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
    image_url: parsed.data.image_url ?? undefined,
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