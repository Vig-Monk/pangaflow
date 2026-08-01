// =============================================================================
// src/verticals/market/agent.controller.ts
// HTTP layer for the agent errand vertical. Thin — no business logic.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as agentService from './agent.service';

function requireOrgId(req: Request): string {
if (!req.orgId) {
throw new AppError('Unauthorized', 401);
}
return req.orgId;
}

export async function createClientHandler(
req: Request,
res: Response,
next: NextFunction
): Promise < void > {
try {
const orgId = requireOrgId(req);
const client = await agentService.addClient(orgId, req.body);
success(res, client, undefined, 201);
} catch (err) {
next(err);
}
}

export async function listClientsHandler(
req: Request,
res: Response,
next: NextFunction
): Promise < void > {
try {
const orgId = requireOrgId(req);
const clients = await agentService.listClients(orgId);
success(res, clients);
} catch (err) {
next(err);
}
}

export async function createOrderHandler(
req: Request,
res: Response,
next: NextFunction
): Promise < void > {
try {
const orgId = requireOrgId(req);
const order = await agentService.addOrder(orgId, req.body);
success(res, order, undefined, 201);
} catch (err) {
next(err);
}
}

export async function todayOrdersHandler(
req: Request,
res: Response,
next: NextFunction
): Promise < void > {
try {
const orgId = requireOrgId(req);
const orders = await agentService.todayOrders(orgId);
success(res, orders);
} catch (err) {
next(err);
}
}

export async function updateOrderStatusHandler(
req: Request,
res: Response,
next: NextFunction
): Promise < void > {
try {
const orgId = requireOrgId(req);
const order = await agentService.updateStatus(orgId, req.params.id, req.body);
success(res, order);
} catch (err) {
next(err);
}
}

export async function dashboardHandler(
req: Request,
res: Response,
next: NextFunction
): Promise < void > {
try {
const orgId = requireOrgId(req);
const summary = await agentService.dashboard(orgId);
success(res, summary);
} catch (err) {
next(err);
}
}