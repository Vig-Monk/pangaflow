// =============================================================================
// src/modules/payments/payments.controller.ts
// HTTP layer for payments. Thin — validation happens via validateBody at
// the route level; this file calls the service and shapes responses.
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { success } from '../../utils/response';
import { AppError } from '../../utils/error';
import * as darajaService from '../../services/daraja.service';
import * as paymentsService from './payments.service';

// ---------------------------------------------------------------------------
// Zod schema — exact text from the spec
// ---------------------------------------------------------------------------

export const StkPushBodySchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  phone: z.string().regex(/^(07|01)\d{8}$/, 'Invalid Kenyan phone number'),
});

export type StkPushBody = z.infer<typeof StkPushBodySchema>;

// ---------------------------------------------------------------------------
// Helper — extracts verified orgId from the request
// ---------------------------------------------------------------------------

function requireOrgId(req: Request): string {
  if (!req.orgId) {
    throw new AppError('Unauthorized', 401);
  }
  return req.orgId;
}

// ---------------------------------------------------------------------------
// POST /payments/mpesa/stk (authenticated)
// ---------------------------------------------------------------------------

export async function stkPushHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = requireOrgId(req);

    // req.body has already been validated AND replaced with the parsed
    // result by validateBody(StkPushBodySchema) at the route level — safe
    // to treat it as StkPushBody directly, no re-parsing needed here.
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

// ---------------------------------------------------------------------------
// POST /payments/mpesa/callback (PUBLIC — no auth)
// ---------------------------------------------------------------------------

/**
 * PUBLIC endpoint — Safaricom posts here with no authentication of any
 * kind. This handler must ALWAYS respond 200, regardless of what happens
 * internally, or Safaricom will retry aggressively and eventually give up
 * entirely, leaving the payment's true outcome permanently unknown to
 * this server.
 *
 * Every failure path below is caught and logged — none of them propagate
 * to next(err), because that would let the global errorHandler send a
 * non-200 status to Safaricom.
 */
export async function callbackHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const parsedCallback = darajaService.parseCallback(req.body);

    try {
      await paymentsService.handleMpesaCallback(parsedCallback);
    } catch (processingError) {
      // Log and swallow — a processing failure (unknown checkoutRequestId,
      // a DB error) must not prevent a 200 response to Safaricom. This is
      // exactly why the spec says "Always return 200 to Safaricom from
      // callback" — the alternative is Safaricom retrying an already-
      // permanently-failed callback indefinitely.
      // eslint-disable-next-line no-console
      console.error('M-Pesa callback processing failed:', processingError);
    }
  } catch (parseError) {
    // parseCallback() itself threw — the request body didn't match
    // Safaricom's known callback shape at all. Still log, still 200.
    // eslint-disable-next-line no-console
    console.error('M-Pesa callback parsing failed:', parseError);
  }

  // ALWAYS 200, no matter what happened above.
  res.status(200).json({ received: true });
}