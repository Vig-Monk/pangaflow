// =============================================================================
// soko-api/src/modules/public/public.controller.ts
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import * as publicService from './public.service';

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
    const products = await publicService.listStoreProducts(req.params.storeSlug);
    success(res, products);
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