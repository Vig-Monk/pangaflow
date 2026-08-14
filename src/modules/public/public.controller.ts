// =============================================================================
// src/modules/public/public.controller.ts
// Controller — Public Storefront Catalog.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import * as publicService from './public.service';

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
    const orderDetails = await publicService.getPublicOrderDetails(req.params.storeSlug, req.params.orderId);
    success(res, orderDetails);
  } catch (err) {
    next(err);
  }
}