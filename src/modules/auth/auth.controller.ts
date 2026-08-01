// =============================================================================
// src/modules/auth/auth.controller.ts
// HTTP layer for auth. Validates input, calls the service, shapes responses.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as authService from './auth.service';

// ---------------------------------------------------------------------------
// Zod schemas — request body validation
// z.infer<> carries the validated shape through without re-annotation.
// ---------------------------------------------------------------------------

export const RegisterBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgName: z.string().min(1, 'Organization name is required').max(200),
  businessType: z.enum(['core', 'shop', 'salon', 'stays', 'market']).default('core'),
});

export const LoginBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const LogoutBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

type RegisterBody = z.infer<typeof RegisterBodySchema>;
type LoginBody = z.infer<typeof LoginBodySchema>;
type RefreshBody = z.infer<typeof RefreshBodySchema>;
type LogoutBody = z.infer<typeof LogoutBodySchema>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = RegisterBodySchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    }

    const body: RegisterBody = parsed.data;

    const result = await authService.register(body);

    success(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = LoginBodySchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    }

    const body: LoginBody = parsed.data;

    const result = await authService.login(body);

    success(res, result, undefined, 200);
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = RefreshBodySchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    }

    const body: RefreshBody = parsed.data;

    const tokens = await authService.refreshTokens(body.refreshToken);

    success(res, tokens, undefined, 200);
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = LogoutBodySchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    }

    const body: LogoutBody = parsed.data;

    await authService.logout(body.refreshToken);

    success(res, { loggedOut: true }, undefined, 200);
  } catch (err) {
    next(err);
  }
}