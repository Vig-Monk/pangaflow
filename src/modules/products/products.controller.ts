// =============================================================================
// src/modules/products/products.controller.ts
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as productsService from './products.service';
import * as productsQueries from './products.queries';

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

export async function uploadSignatureHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const target = req.query.target === 'store' ? 'store' : 'products';
    
    const signature = await productsService.generateUploadSignature(orgId, target);
    success(res, signature);
  } catch (err) {
    next(err);
  }
}

export async function deleteProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const deleted = await productsService.deleteMerchantProduct(orgId, req.params.id);
    if (!deleted) {
      throw new AppError('Product not found', 404);
    }
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function createCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const category = await productsService.createCategory(orgId, req.body.name);
    success(res, category, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function listCategoriesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const categories = await productsQueries.listCategories(orgId);
    success(res, categories);
  } catch (err) {
    next(err);
  }
}

export async function listProductsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const result = await productsService.listMerchantProducts(orgId, req.query);
    
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    success(res, result.products, {
      page,
      limit,
      totalItems: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const product = await productsService.getMerchantProduct(orgId, req.params.id);
    success(res, product);
  } catch (err) {
    next(err);
  }
}

export async function updateProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const product = await productsService.modifyMerchantProduct(orgId, req.params.id, req.body);
    success(res, product);
  } catch (err) {
    next(err);
  }
}

export async function publishProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const product = await productsService.updateMerchantProductStatus(orgId, req.params.id, 'published');
    success(res, product);
  } catch (err) {
    next(err);
  }
}

export async function unpublishProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const product = await productsService.updateMerchantProductStatus(orgId, req.params.id, 'draft');
    success(res, product);
  } catch (err) {
    next(err);
  }
}

export async function archiveProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const product = await productsService.archiveMerchantProduct(orgId, req.params.id);
    success(res, { archived: true, product });
  } catch (err) {
    next(err);
  }
}

export async function unarchiveProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const product = await productsService.unarchiveMerchantProduct(orgId, req.params.id);
    success(res, { unarchived: true, product });
  } catch (err) {
    next(err);
  }
}

export async function listInventoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const result = await productsService.listMerchantInventory(orgId, req.query);
    
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    success(res, result.inventory, {
      page,
      limit,
      totalItems: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStockHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const inventory = await productsService.updateMerchantStock(orgId, req.params.productId, req.body);
    success(res, inventory);
  } catch (err) {
    next(err);
  }
}

export async function createProductsBulkHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const resultProducts = await productsService.createProductsBulk(orgId, req.body);
    success(res, resultProducts, undefined, 201);
  } catch (err) {
    next(err);
  }
}