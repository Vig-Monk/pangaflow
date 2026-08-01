// =============================================================================
// src/modules/customers/customers.controller.ts
// HTTP layer for the customers module.
// Each handler: validates nothing (service owns validation), calls service,
// shapes response. Zero direct query calls. Zero business logic.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as customersService from './customers.service';

// ---------------------------------------------------------------------------
// Helper — extracts req.orgId and throws 401 if missing.
// After verifyToken runs, req.orgId is always set — this guard exists to
// satisfy TypeScript's strict null checks (orgId is typed as string | undefined
// on the base Request interface) without scattering non-null assertions.
// ---------------------------------------------------------------------------

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

// ---------------------------------------------------------------------------
// GET /customers
// ---------------------------------------------------------------------------

export async function listHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const result = await customersService.list(orgId, req.query);
    success(res, result.customers, {
      page:       Number(req.query.page ?? 1),
      limit:      Number(req.query.limit ?? 20),
      totalItems: result.total,
      totalPages: Math.ceil(result.total / Number(req.query.limit ?? 20)),
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /customers/search  ← must be registered BEFORE /customers/:id
// ---------------------------------------------------------------------------

export async function searchHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const customers = await customersService.search(orgId, req.query);
    success(res, customers);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /customers/:id
// ---------------------------------------------------------------------------

export async function getOneHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const customer = await customersService.getOne(orgId, req.params.id);
    success(res, customer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /customers
// ---------------------------------------------------------------------------

export async function createHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const customer = await customersService.create(orgId, req.body);
    success(res, customer, undefined, 201);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /customers/:id
// ---------------------------------------------------------------------------

export async function updateHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const customer = await customersService.update(orgId, req.params.id, req.body);
    success(res, customer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /customers/:id
// Soft-deletes by default. PATCH /customers/:id/archive handles archiving.
// ---------------------------------------------------------------------------

export async function deleteHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    await customersService.remove(orgId, req.params.id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /customers/:id/archive
// Separate endpoint so DELETE stays idiomatic (permanent removal) and
// archive is explicit (soft-hide). Cleaner than a ?action= query param.
// ---------------------------------------------------------------------------

export async function archiveHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    await customersService.archive(orgId, req.params.id);
    success(res, { archived: true });
  } catch (err) {
    next(err);
  }
}