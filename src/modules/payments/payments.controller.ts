// =============================================================================
// soko-api/src/modules/payments/payments.controller.ts
// HTTP controller layer for M-Pesa STK push and webhook callbacks.
// Always returns 200 to Safaricom from callback.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as paymentsService from './payments.service';

export const StkPushBodySchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  phone: z.string().regex(/^(07|01|254|\+254)\d{8}$/, 'Invalid Kenyan phone number'),
});

export type StkPushBody = z.infer<typeof StkPushBodySchema>;

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

export async function stkPushHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);
    const body = req.body as StkPushBody;

    const result = await paymentsService.initiatePayment({
      orgId,
      customerId: body.customerId,
      amount: body.amount,
      phone: body.phone,
      paymentMethod: 'mpesa',
    });

    success(res, result, undefined, 202);
  } catch (err) {
    next(err);
  }
}

/**
 * PUBLIC Webhook callback from Safaricom Daraja.
 * Logs raw payload immediately to mpesa_callbacks and ALWAYS returns 200.
 */
export async function callbackHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    await paymentsService.handleMpesaCallback(req.body);
  } catch (processingError) {
    // Log and swallow so Safaricom receives 200 and stops duplicate retries
    console.error('M-Pesa callback processing error:', processingError);
  }

  res.status(200).json({ received: true });
}