// =============================================================================
// soko-api/src/modules/banners/banners.controller.ts
// Controller layer for promotional hero banners.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as bannersService from './banners.service';
import { getStoreBySlugPublic } from '../public/public.queries';

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

export async function listPublicBannersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { storeSlug } = req.params;
    if (!storeSlug) {
      throw new AppError('Store slug is required', 400);
    }

    const store = await getStoreBySlugPublic(storeSlug);
    if (!store) {
      throw new AppError('Store not found', 404);
    }

    const banners = await bannersService.getPublicActiveBanners(store.org_id);
    success(res, banners);
  } catch (err) {
    next(err);
  }
}

export async function trackBannerClickHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError('Banner ID is required', 400);
    }

    await bannersService.recordClick(id);
    success(res, { tracked: true });
  } catch (err) {
    next(err);
  }
}

export async function listAdminBannersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const banners = await bannersService.getAdminBanners(orgId);
    success(res, banners);
  } catch (err) {
    next(err);
  }
}

export async function createBannerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const banner = await bannersService.createBanner(orgId, req.body);
    success(res, banner, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateBannerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const banner = await bannersService.updateBanner(orgId, req.params.id, req.body);
    success(res, banner);
  } catch (err) {
    next(err);
  }
}

export async function deleteBannerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    await bannersService.deleteBanner(orgId, req.params.id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function reorderBannersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    await bannersService.reorderBanners(orgId, req.body);
    success(res, { reordered: true });
  } catch (err) {
    next(err);
  }
}