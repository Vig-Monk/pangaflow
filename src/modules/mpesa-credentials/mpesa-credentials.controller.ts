// =============================================================================
// src/modules/mpesa-credentials/mpesa-credentials.controller.ts
// =============================================================================

import { Request, Response, NextFunction } from "express";
import { success } from "../../utils/response";
import { AppError } from "../../utils/error";
import * as credsService from "./mpesa-credentials.service";

function requireOrgId(req: Request): string {
    if (!req.orgId) {
        throw new AppError("Unauthorized", 401);
    }
    return req.orgId;
}

export async function getCredentialsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const orgId = requireOrgId(req);
        const result = await credsService.getCredentials(orgId);
        success(res, result);
    } catch (err) {
        next(err);
    }
}

export async function saveCredentialsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const orgId = requireOrgId(req);
        const result = await credsService.saveCredentials(orgId, req.body);
        success(res, result, undefined, 200);
    } catch (err) {
        next(err);
    }
}

export async function verifyCredentialsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const orgId = requireOrgId(req);
        const result = await credsService.verifyCredentials(orgId, req.body);
        success(res, result, undefined, 200);
    } catch (err) {
        next(err);
    }
}

export async function deleteCredentialsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const orgId = requireOrgId(req);
        await credsService.removeCredentials(orgId);
        success(res, { deleted: true });
    } catch (err) {
        next(err);
    }
}
