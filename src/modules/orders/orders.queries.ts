// =============================================================================
// src/modules/orders/orders.queries.ts
// =============================================================================

import { PoolClient } from "pg";
import { query, pool } from "../../config/db";
import { recordTransaction } from "../transactions/transactions.queries";

export interface Order {
    id: string;
    org_id: string;
    store_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    delivery_location: string;
    notes: string | null;
    status: "pending" | "confirmed" | "fulfilled" | "cancelled";
    payment_method: string;
    payment_status: "pending" | "paid" | "failed";
    total: string;
    created_at: Date;
    updated_at: Date;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    product_name: string;
    unit_price: string;
    quantity: number;
    subtotal: string;
}

export interface OrderWithItems extends Order {
    items: OrderItem[];
}

export interface ListOrdersOptions {
    page: number;
    limit: number;
}

export interface OrdersSummary {
    today_count: number;
    today_revenue: string;
    pending_count: number;
}

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrdersSummary(orgId: string): Promise<OrdersSummary> {
    const result = await query<{
        today_count: string;
        today_revenue: string;
        pending_count: string;
    }>(
        `SELECT 
       COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::text AS today_count,
       COALESCE(SUM(total) FILTER (WHERE created_at >= CURRENT_DATE AND status != 'cancelled'), 0)::text AS today_revenue,
       COUNT(*) FILTER (WHERE status = 'pending')::text AS pending_count
     FROM orders
     WHERE org_id = $1`,
        [orgId]
    );

    const row = result.rows[0];
    return {
        today_count: parseInt(row?.today_count ?? "0", 10),
        today_revenue: row?.today_revenue ?? "0",
        pending_count: parseInt(row?.pending_count ?? "0", 10)
    };
}

// ---------------------------------------------------------------------------
// Transactional Helper Queries
// ---------------------------------------------------------------------------

export async function insertOrderTransactional(
    client: PoolClient,
    data: {
        orgId: string;
        storeId: string;
        customerName: string;
        customerPhone: string;
        customerEmail?: string | null;
        deliveryLocation: string;
        notes?: string | null;
        paymentMethod: string;
        total: number;
    }
): Promise<string> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO orders (
       org_id, store_id, customer_name, customer_phone, customer_email,
       delivery_location, notes, payment_method, total
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
        [
            data.orgId,
            data.storeId,
            data.customerName,
            data.customerPhone,
            data.customerEmail ?? null,
            data.deliveryLocation,
            data.notes ?? null,
            data.paymentMethod,
            data.total
        ]
    );
    return result.rows[0].id;
}

export async function insertOrderItemTransactional(
    client: PoolClient,
    orderId: string,
    item: {
        productId: string;
        productName: string;
        unitPrice: number;
        quantity: number;
        subtotal: number;
    }
): Promise<void> {
    await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            orderId,
            item.productId,
            item.productName,
            item.unitPrice,
            item.quantity,
            item.subtotal
        ]
    );
}

export async function decrementStockTransactional(
    client: PoolClient,
    productId: string,
    quantity: number
): Promise<boolean> {
    const result = await client.query(
        `UPDATE inventory
     SET    stock      = stock - $1
     WHERE  product_id = $2
       AND  stock      >= $1`,
        [quantity, productId]
    );
    return result.rowCount !== null && result.rowCount > 0;
}

export async function findOrderForWebhook(
    client: PoolClient,
    orderId: string
): Promise<Order | null> {
    if (!UUID_REGEX.test(orderId.trim())) {
        return null;
    }

    const result = await client.query<Order>(
        `SELECT id, org_id, store_id, customer_name, customer_phone, customer_email,
            delivery_location, notes, status, payment_method, payment_status,
            total::text AS total, created_at, updated_at
     FROM   orders
     WHERE  id = $1`,
        [orderId.trim()]
    );

    return result.rows[0] ?? null;
}

export async function markOrderAsPaidTransactional(
    client: PoolClient,
    orderId: string
): Promise<Order | null> {
    if (!UUID_REGEX.test(orderId.trim())) {
        return null;
    }

    const result = await client.query<Order>(
        `UPDATE orders
     SET    payment_status = 'paid',
            status = (CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END),
            updated_at = NOW()
     WHERE  id = $1
     RETURNING id, org_id, store_id, customer_name, customer_phone, customer_email,
               delivery_location, notes, status, payment_method, payment_status,
               total::text AS total, created_at, updated_at`,
        [orderId.trim()]
    );

    return result.rows[0] ?? null;
}

export async function markOrderPaymentFailedTransactional(
    client: PoolClient,
    orderId: string
): Promise<Order | null> {
    if (!UUID_REGEX.test(orderId.trim())) {
        return null;
    }

    const result = await client.query<Order>(
        `UPDATE orders
     SET    payment_status = 'failed',
            updated_at = NOW()
     WHERE  id = $1
     RETURNING id, org_id, store_id, customer_name, customer_phone, customer_email,
               delivery_location, notes, status, payment_method, payment_status,
               total::text AS total, created_at, updated_at`,
        [orderId.trim()]
    );

    return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Merchant Order Operations
// ---------------------------------------------------------------------------

export async function listOrders(
    orgId: string,
    options: ListOrdersOptions
): Promise<{ orders: Order[]; total: number }> {
    const limit =
        isNaN(options.limit) || options.limit <= 0 ? 20 : options.limit;
    const offset = (options.page - 1) * limit;

    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM orders WHERE org_id = $1`,
        [orgId]
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    if (total === 0) {
        return { orders: [], total: 0 };
    }

    const dataResult = await query<Order>(
        `SELECT id, store_id, customer_name, customer_phone, customer_email,
            delivery_location, status, payment_method, payment_status,
            total::text AS total, created_at, updated_at
     FROM   orders
     WHERE  org_id = $1
     ORDER  BY created_at DESC
     LIMIT  $2 OFFSET $3`,
        [orgId, limit, offset]
    );

    return { orders: dataResult.rows, total };
}

export async function getOrderById(
    orgId: string,
    orderId: string
): Promise<OrderWithItems | null> {
    if (!UUID_REGEX.test(orderId.trim())) {
        return null;
    }

    const orderResult = await query<Order>(
        `SELECT id, store_id, customer_name, customer_phone, customer_email,
            delivery_location, notes, status, payment_method, payment_status,
            total::text AS total, created_at, updated_at
     FROM   orders
     WHERE  org_id = $1 AND id = $2`,
        [orgId, orderId.trim()]
    );

    const order = orderResult.rows[0];
    if (!order) return null;

    const itemsResult = await query<OrderItem>(
        `SELECT id, order_id, product_id, product_name, unit_price::text AS unit_price,
            quantity, subtotal::text AS subtotal
     FROM   order_items
     WHERE  order_id = $1`,
        [orderId.trim()]
    );

    return {
        ...order,
        items: itemsResult.rows
    };
}

export async function updateOrderStatus(
    orgId: string,
    orderId: string,
    status: "pending" | "confirmed" | "fulfilled" | "cancelled"
): Promise<OrderWithItems | null> {
    if (!UUID_REGEX.test(orderId.trim())) {
        return null;
    }

    await query(
        `UPDATE orders 
     SET status = $3, updated_at = NOW() 
     WHERE org_id = $1 AND id = $2`,
        [orgId, orderId.trim(), status]
    );
    return getOrderById(orgId, orderId);
}

/**
 * Allows merchants to manually mark an order as paid (e.g. for cash on delivery),
 * syncing the revenue with the financial dashboard and customer CRM.
 */
export async function updateOrderPaymentStatus(
    orgId: string,
    orderId: string,
    paymentStatus: "pending" | "paid" | "failed"
): Promise<OrderWithItems | null> {
    if (!UUID_REGEX.test(orderId.trim())) {
        return null;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const orderRes = await client.query<Order>(
            `UPDATE orders
       SET    payment_status = $3,
              status = (CASE WHEN $3 = 'paid' AND status = 'pending' THEN 'confirmed' ELSE status END),
              updated_at = NOW()
       WHERE  org_id = $1 AND id = $2
       RETURNING id, org_id, store_id, customer_name, customer_phone, customer_email,
                 delivery_location, notes, status, payment_method, payment_status,
                 total::text AS total, created_at, updated_at`,
            [orgId, orderId.trim(), paymentStatus]
        );

        const order = orderRes.rows[0];
        if (!order) {
            await client.query("ROLLBACK");
            return null;
        }

        if (paymentStatus === "paid" && order.customer_phone) {
            const custRes = await client.query<{ id: string }>(
                `SELECT id FROM customers WHERE org_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
                [orgId, order.customer_phone]
            );

            let customerId = custRes.rows[0]?.id;
            if (!customerId) {
                const newCustRes = await client.query<{ id: string }>(
                    `INSERT INTO customers (org_id, name, phone, address)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
                    [
                        orgId,
                        order.customer_name,
                        order.customer_phone,
                        order.delivery_location
                    ]
                );
                customerId = newCustRes.rows[0]?.id;
            }

            if (customerId) {
                const amount = parseFloat(order.total);
                await recordTransaction(client, {
                    orgId,
                    customerId,
                    type: "sale",
                    amount,
                    description: `Storefront Order #${order.id.slice(0, 8)}`,
                    createdBy: null
                });

                await recordTransaction(client, {
                    orgId,
                    customerId,
                    type: "payment",
                    amount,
                    description: `Manual Payment Received (${order.payment_method})`,
                    createdBy: null
                });
            }
        }

        await client.query("COMMIT");
        return getOrderById(orgId, orderId);
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}
