// =============================================================================
// soko-api/src/modules/payments/payments.service.ts
// Multi-tenant M-Pesa processing with audit persistence & idempotency guards.
// =============================================================================

import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../utils/error";
import * as darajaService from "../../services/daraja.service";
import {
    createPendingMpesaTransaction,
    findRecentPendingMpesaTransaction,
    getMpesaTransactionByCheckoutId,
    logRawMpesaCallback,
    markCallbackProcessed,
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
import { fulfillDigitalItems } from "../../verticals/books/delivery.service";

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

function normalizePhone(input: string): string {
    const digits = (input || "").replace(/\D/g, "");
    if (digits.startsWith("254") && digits.length === 12) {
        return `0${digits.slice(3)}`;
    }
    if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) {
        return `0${digits}`;
    }
    return digits.slice(0, 10);
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
    // 1. STK Push Idempotency Guard (60-second in-flight check)
    const recent = await findRecentPendingMpesaTransaction(input.customerId, 60);
    if (recent) {
        return {
            checkoutRequestId: recent.checkout_request_id,
            merchantRequestId: recent.merchant_request_id,
            customerMessage: "An M-Pesa payment prompt is already pending on your phone. Please check your screen."
        };
    }

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
        transactionDesc: "Store Payment",
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
            transactionDesc: "Store Payment"
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

/**
 * Handles incoming Daraja callback with raw audit logging & transaction idempotency.
 */
export async function handleMpesaCallback(rawPayload: unknown): Promise<void> {
    const parsed = darajaService.parseCallback(rawPayload);

    // 1. Audit Log: Persist raw payload immediately
    const auditId = await logRawMpesaCallback(
        parsed.checkoutRequestId,
        parsed.merchantRequestId,
        parsed.resultCode,
        rawPayload
    );

    const existing = await getMpesaTransactionByCheckoutId(parsed.checkoutRequestId);

    if (!existing) {
        await markCallbackProcessed(auditId, false, `Transaction ${parsed.checkoutRequestId} not found.`);
        return;
    }

    // 2. Idempotency Check: Exit cleanly if already settled (prevents duplicate tokens & ledger entries)
    if (existing.status === "completed") {
        await markCallbackProcessed(auditId, true, "Ignored: already completed.");
        return;
    }

    const isVerification = existing.account_reference.includes("VERIFY");
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 3. Update mpesa_transactions record
        await updateMpesaTransactionByCheckoutId(
            client,
            parsed.checkoutRequestId,
            {
                status: parsed.isSuccess ? "completed" : "failed",
                resultCode: parsed.resultCode,
                resultDesc: parsed.resultDesc,
                mpesaReceiptNumber: parsed.mpesaReceiptNumber ?? undefined,
                transactionDate: parsed.transactionDate
                    ? new Date(parsed.transactionDate)
                    : undefined
            }
        );

        // 4. Context Routing: Till Verification vs Storefront Order
        if (isVerification) {
            if (parsed.isSuccess) {
                await updateVerificationStatus(existing.org_id, "verified", null);
            } else {
                await updateVerificationStatus(existing.org_id, "failed", parsed.resultDesc);
            }
        } else {
            const order = await findOrderForWebhook(client, existing.account_reference);

            if (order) {
                if (parsed.isSuccess) {
                    await markOrderAsPaidTransactional(client, order.id);

                    // Fulfill digital eBook download tokens automatically to PostgreSQL
                    await fulfillDigitalItems(order.id, client);

                    // Reconcile customer in CRM
                    let customerId = existing.customer_id;
                    if (!customerId && order.customer_phone) {
                        const cleanPhone = normalizePhone(order.customer_phone);
                        const custRes = await client.query<{ id: string }>(
                            `SELECT id FROM customers WHERE org_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
                            [order.org_id, cleanPhone]
                        );

                        if (custRes.rows.length > 0) {
                            customerId = custRes.rows[0].id;
                        } else {
                            const newCustRes = await client.query<{ id: string }>(
                                `INSERT INTO customers (org_id, name, phone, address)
                                 VALUES ($1, $2, $3, $4)
                                 RETURNING id`,
                                [
                                    order.org_id,
                                    order.customer_name,
                                    cleanPhone,
                                    order.delivery_location
                                ]
                            );
                            customerId = newCustRes.rows[0]?.id;
                        }
                    }

                    // Record in financial ledger
                    if (customerId) {
                        const amount = parsed.amount ?? parseFloat(order.total);
                        const receipt = parsed.mpesaReceiptNumber || "N/A";

                        await recordTransaction(client, {
                            orgId: order.org_id,
                            customerId,
                            type: "sale",
                            amount,
                            description: `Storefront Order #${order.id.slice(0, 8)}`,
                            createdBy: null
                        });

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
            } else if (parsed.isSuccess && existing.customer_id) {
                await recordTransaction(client, {
                    orgId: existing.org_id,
                    customerId: existing.customer_id,
                    type: "payment",
                    amount: parsed.amount ?? parseFloat(existing.amount),
                    description: `M-Pesa payment — receipt ${parsed.mpesaReceiptNumber ?? "N/A"}`,
                    createdBy: null
                });
            }
        }

        await client.query("COMMIT");
        await markCallbackProcessed(auditId, true, null);
    } catch (err: any) {
        await client.query("ROLLBACK");
        await markCallbackProcessed(auditId, false, err.message || "Database update failed.");
        throw err;
    } finally {
        client.release();
    }
}