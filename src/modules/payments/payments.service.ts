// =============================================================================
// src/modules/payments/payments.service.ts
// =============================================================================

import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/error";
import * as darajaService from "../../services/daraja.service";
import { MpesaCallbackResult } from "../../services/daraja.service";
import {
    createPendingMpesaTransaction,
    getMpesaTransactionByCheckoutId,
    updateMpesaTransactionByCheckoutId
} from "./payments.queries";
import { recordTransaction } from "../transactions/transactions.queries";
import {
    getCredentialsRowByOrgId,
    getDecryptedCredentials,
    updateVerificationStatus
} from "../mpesa-credentials/mpesa-credentials.queries";
import {
    findOrderForWebhook,
    markOrderAsPaidTransactional,
    markOrderPaymentFailedTransactional
} from "../orders/orders.queries";

export type PaymentMethod = "mpesa" | "stripe";

export interface InitiatePaymentInput {
    orgId: string;
    customerId: string;
    amount: number;
    phone: string;
    paymentMethod: PaymentMethod;
}

export interface InitiatePaymentResult {
    checkoutRequestId: string;
    merchantRequestId: string;
    customerMessage: string;
}

export async function initiatePayment(
    input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
    switch (input.paymentMethod) {
        case "mpesa":
            return initiateMpesaPayment(input);

        case "stripe":
            throw new AppError(
                "Stripe payments are not yet available. Please use M-Pesa.",
                501
            );

        default: {
            const _exhaustive: never = input.paymentMethod;
            throw new AppError(
                `Unsupported payment method: ${String(_exhaustive)}`,
                400
            );
        }
    }
}

async function initiateMpesaPayment(
    input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
    const credsRow = await getCredentialsRowByOrgId(input.orgId);
    if (!credsRow || credsRow.status !== "verified") {
        throw new AppError(
            "This store hasn't finished setting up payments yet",
            503
        );
    }

    const creds = await getDecryptedCredentials(input.orgId);
    if (!creds) {
        throw new AppError(
            "This store hasn't finished setting up payments yet",
            503
        );
    }

    const callbackUrl = `${env.API_PUBLIC_URL.replace(/\/$/, "")}/api/v1/payments/mpesa/callback`;

    const stkResult = await darajaService.stkPush({
        credentials: {
            tillType: creds.tillType,
            shortcode: creds.shortcode,
            storeNumber: creds.storeNumber,
            consumerKey: creds.consumerKey,
            consumerSecret: creds.consumerSecret,
            passkey: creds.passkey,
            environment: creds.environment
        },
        phone: input.phone,
        amount: input.amount,
        accountReference: input.customerId,
        transactionDesc: "Soko payment",
        callbackUrl
    });

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await createPendingMpesaTransaction(client, {
            orgId: input.orgId,
            customerId: input.customerId,
            checkoutRequestId: stkResult.checkoutRequestId,
            merchantRequestId: stkResult.merchantRequestId,
            phone: input.phone,
            amount: input.amount,
            accountReference: input.customerId,
            transactionDesc: "Soko payment"
        });

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }

    return {
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
        customerMessage: stkResult.customerMessage
    };
}

export async function handleMpesaCallback(
    callback: MpesaCallbackResult
): Promise<void> {
    const existing = await getMpesaTransactionByCheckoutId(
        callback.checkoutRequestId
    );

    if (!existing) {
        throw new AppError(
            `No M-Pesa transaction found for checkoutRequestId: ${callback.checkoutRequestId}`,
            404
        );
    }

    // Idempotency: Skip if already processed
    if (existing.status === "completed") {
        return;
    }

    const isVerification = existing.account_reference === "SOKO-VERIFY";
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Update mpesa_transactions record
        await updateMpesaTransactionByCheckoutId(
            client,
            callback.checkoutRequestId,
            {
                status: callback.isSuccess ? "completed" : "failed",
                resultCode: callback.resultCode,
                resultDesc: callback.resultDesc,
                mpesaReceiptNumber: callback.mpesaReceiptNumber ?? undefined,
                transactionDate: callback.transactionDate
                    ? new Date(callback.transactionDate)
                    : undefined
            }
        );

        // 2. Route by transaction context
        if (isVerification) {
            // Case A: Till Verification STK Test
            if (callback.isSuccess) {
                await updateVerificationStatus(
                    existing.org_id,
                    "verified",
                    null
                );
            } else {
                await updateVerificationStatus(
                    existing.org_id,
                    "failed",
                    callback.resultDesc
                );
            }
        } else {
            // Check if reference matches an Order UUID
            const order = await findOrderForWebhook(
                client,
                existing.account_reference
            );

            if (order) {
                // Case B: Storefront Customer Order Payment
                if (callback.isSuccess) {
                    await markOrderAsPaidTransactional(client, order.id);

                    // Find or create customer entry in merchant directory
                    let customerId = existing.customer_id;
                    if (!customerId && order.customer_phone) {
                        const custRes = await client.query<{ id: string }>(
                            `SELECT id FROM customers WHERE org_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
                            [order.org_id, order.customer_phone]
                        );

                        if (custRes.rows.length > 0) {
                            customerId = custRes.rows[0].id;
                        } else {
                            const newCustRes = await client.query<{
                                id: string;
                            }>(
                                `INSERT INTO customers (org_id, name, phone, address)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                                [
                                    order.org_id,
                                    order.customer_name,
                                    order.customer_phone,
                                    order.delivery_location
                                ]
                            );
                            customerId = newCustRes.rows[0].id;
                        }
                    }

                    // Record in financial ledger so Dashboard revenue updates immediately
                    if (customerId) {
                        const amount =
                            callback.amount ?? parseFloat(order.total);
                        const receipt = callback.mpesaReceiptNumber || "N/A";

                        // Record sale (increases sales count/total)
                        await recordTransaction(client, {
                            orgId: order.org_id,
                            customerId,
                            type: "sale",
                            amount,
                            description: `Storefront Order #${order.id.slice(0, 8)}`,
                            createdBy: null
                        });

                        // Record payment (clears balance to 0 while crediting dashboard revenue)
                        await recordTransaction(client, {
                            orgId: order.org_id,
                            customerId,
                            type: "payment",
                            amount,
                            description: `M-Pesa Payment — Receipt ${receipt}`,
                            createdBy: null
                        });
                    }
                } else {
                    await markOrderPaymentFailedTransactional(client, order.id);
                }
            } else if (callback.isSuccess && existing.customer_id) {
                // Case C: Manual Customer Credit Ledger Payment
                await recordTransaction(client, {
                    orgId: existing.org_id,
                    customerId: existing.customer_id,
                    type: "payment",
                    amount: callback.amount ?? parseFloat(existing.amount),
                    description: `M-Pesa payment — receipt ${callback.mpesaReceiptNumber ?? "N/A"}`,
                    createdBy: null
                });
            }
        }

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}
