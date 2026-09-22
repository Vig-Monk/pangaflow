// =============================================================================
// soko-api/src/modules/public/public.controller.ts
// Public HTTP Controller: Catalog Ingestion with First-Added-First Default Sort
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import * as publicService from './public.service';
import type { ProductSortOption } from './public.queries';

const VALID_SORT_OPTIONS: ProductSortOption[] = [
  'first_added',
  'newest',
  'price_asc',
  'price_desc',
  'title_asc',
];

export async function searchDeliveryLocationsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const results = await publicService.searchDeliveryLocations(req.query);
    success(res, results);
  } catch (err) {
    next(err);
  }
}

export async function getStoreMetadataHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const store = await publicService.getStoreMetadata(req.params.storeSlug);
    success(res, store);
  } catch (err) {
    next(err);
  }
}

export async function listStoreProductsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const searchQuery = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const category = typeof req.query.category === 'string'
      ? req.query.category.trim()
      : (typeof req.query.category_id === 'string' ? req.query.category_id.trim() : undefined);

    // Default to 'first_added' (FIFO) so foundational titles and verified covers show first
    let sort: ProductSortOption = 'first_added';
    if (typeof req.query.sort === 'string') {
      const candidate = req.query.sort.trim().toLowerCase() as ProductSortOption;
      if (VALID_SORT_OPTIONS.includes(candidate)) {
        sort = candidate;
      }
    }

    const result = await publicService.listStoreProducts(req.params.storeSlug, {
      page,
      limit,
      searchQuery,
      category,
      sort,
    });

    success(res, result, {
      page: result.page,
      limit: result.limit,
      totalItems: result.total,
      totalPages: result.totalPages,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await publicService.getProductDetails(req.params.storeSlug, req.params.productSlug);
    success(res, product);
  } catch (err) {
    next(err);
  }
}

export async function placeOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await publicService.placeOrder(req.params.storeSlug, req.body);
    success(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function getPublicOrderDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const verifyingPhone = typeof req.query.phone === 'string' ? req.query.phone : undefined;
    const orderDetails = await publicService.getPublicOrderDetails(
      req.params.storeSlug,
      req.params.orderId,
      verifyingPhone
    );
    success(res, orderDetails);
  } catch (err) {
    next(err);
  }
}

export async function retryOrderPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await publicService.retryOrderPayment(
      req.params.storeSlug,
      req.params.orderId,
      req.body
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
}