// =============================================================================
// src/modules/orders/orders.queries.ts
// =============================================================================

import { PoolClient } from "pg";
import { query, pool } from "../../config/db";
import { recordTransaction } from "../transactions/transactions.queries";
import { computeHaversineDistanceKm } from "../../utils/geo";
import { normalizeDeliveryConfirmationCode } from "../../utils/crypto";
import { AppError } from "../../utils/error";

export interface Order {
    id: string;
    org_id: string;
    store_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    delivery_location: string;
    notes: string | null;
    status:
        | "pending"
        | "confirmed"
        | "assigned"
        | "out_for_delivery"
        | "delivered"
        | "cancelled";
    payment_method: string;
    payment_status: "pending" | "paid" | "failed";
    total: string;
    delivery_type: "delivery" | "pickup";
    customer_lat: string | null;
    customer_lng: string | null;
    location_source: string | null;
    location_accuracy_m: string | null;
    location_captured_at: Date | null;
    rider_name: string | null;
    rider_phone: string | null;
    delivery_fee: string;
    delivery_fee_status: "known" | "needs_merchant_confirmation";
    delivery_confirmation_code: string | null;
    amount_collected: string | null;
    collected_by: string | null;
    delivered_at: Date | null;
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

export interface MerchantLocationRow {
    id: string;
    org_id: string;
    name: string;
    lat: string;
    lng: string;
    address_text: string | null;
    max_delivery_radius_km: string;
    base_delivery_fee: string;
    fee_per_km: string;
}

export interface NearbyOrderRow {
    id: string;
    customer_name: string;
    customer_phone: string;
    delivery_location: string;
    total: string;
    customer_lat: number;
    customer_lng: number;
    distance_km: number;
}

export interface CashReconciliationSummary {
    total_cod_orders: number;
    delivered_cod_orders: number;
    expected_total: string;
    collected_total: string;
    variance: string;
    unreconciled_count: number;
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

export async function getMerchantLocationTransactional(
    client: PoolClient,
    orgId: string
): Promise<MerchantLocationRow | null> {
    const result = await client.query<MerchantLocationRow>(
        `SELECT id, org_id, name, lat::text AS lat, lng::text AS lng, address_text,
            max_delivery_radius_km::text AS max_delivery_radius_km,
            base_delivery_fee::text AS base_delivery_fee,
            fee_per_km::text AS fee_per_km
     FROM   merchant_locations
     WHERE  org_id = $1`,
        [orgId]
    );
    return result.rows[0] ?? null;
}

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
        deliveryType?: "delivery" | "pickup";
        customerLat?: number | null;
        customerLng?: number | null;
        locationSource?: string | null;
        locationAccuracyM?: number | null;
        deliveryFee?: number;
        deliveryFeeStatus?: "known" | "needs_merchant_confirmation";
        deliveryConfirmationCode?: string | null;
    }
): Promise<string> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO orders (
       org_id, store_id, customer_name, customer_phone, customer_email,
       delivery_location, notes, payment_method, total,
       delivery_type, customer_lat, customer_lng, location_source,
       location_accuracy_m, location_captured_at, delivery_fee,
       delivery_fee_status, delivery_confirmation_code
     )
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12, $13,
       $14, (CASE WHEN $11 IS NOT NULL THEN NOW() ELSE NULL END), $15,
       $16, $17
     )
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
            data.total,
            data.deliveryType ?? "delivery",
            data.customerLat ?? null,
            data.customerLng ?? null,
            data.locationSource ?? null,
            data.locationAccuracyM ?? null,
            data.deliveryFee ?? 0,
            data.deliveryFeeStatus ?? "known",
            data.deliveryConfirmationCode ?? null
        ]
    );
    return result.rows[0].id;
}

export async function insertOrderStatusHistoryTransactional(
    client: PoolClient,
    orderId: string,
    status: string,
    changedBy: string = "system"
): Promise<void> {
    await client.query(
        `INSERT INTO order_status_history (order_id, status, changed_by)
     VALUES ($1, $2, $3)`,
        [orderId, status, changedBy]
    );
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
            total::text AS total, delivery_type, customer_lat::text AS customer_lat,
            customer_lng::text AS customer_lng, location_source,
            location_accuracy_m::text AS location_accuracy_m, location_captured_at,
            rider_name, rider_phone, delivery_fee::text AS delivery_fee,
            delivery_fee_status, delivery_confirmation_code,
            amount_collected::text AS amount_collected, collected_by, delivered_at,
            created_at, updated_at
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
               total::text AS total, delivery_type, customer_lat::text AS customer_lat,
               customer_lng::text AS customer_lng, location_source,
               location_accuracy_m::text AS location_accuracy_m, location_captured_at,
               rider_name, rider_phone, delivery_fee::text AS delivery_fee,
               delivery_fee_status, delivery_confirmation_code,
               amount_collected::text AS amount_collected, collected_by, delivered_at,
               created_at, updated_at`,
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
               total::text AS total, delivery_type, customer_lat::text AS customer_lat,
               customer_lng::text AS customer_lng, location_source,
               location_accuracy_m::text AS location_accuracy_m, location_captured_at,
               rider_name, rider_phone, delivery_fee::text AS delivery_fee,
               delivery_fee_status, delivery_confirmation_code,
               amount_collected::text AS amount_collected, collected_by, delivered_at,
               created_at, updated_at`,
        [orderId.trim()]
    );

    return result.rows[0] ?? null;
}

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
        `SELECT id, org_id, store_id, customer_name, customer_phone, customer_email,
            delivery_location, notes, status, payment_method, payment_status,
            total::text AS total, delivery_type, customer_lat::text AS customer_lat,
            customer_lng::text AS customer_lng, location_source,
            location_accuracy_m::text AS location_accuracy_m, location_captured_at,
            rider_name, rider_phone, delivery_fee::text AS delivery_fee,
            delivery_fee_status, delivery_confirmation_code,
            amount_collected::text AS amount_collected, collected_by, delivered_at,
            created_at, updated_at
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
        `SELECT id, org_id, store_id, customer_name, customer_phone, customer_email,
            delivery_location, notes, status, payment_method, payment_status,
            total::text AS total, delivery_type, customer_lat::text AS customer_lat,
            customer_lng::text AS customer_lng, location_source,
            location_accuracy_m::text AS location_accuracy_m, location_captured_at,
            rider_name, rider_phone, delivery_fee::text AS delivery_fee,
            delivery_fee_status, delivery_confirmation_code,
            amount_collected::text AS amount_collected, collected_by, delivered_at,
            created_at, updated_at
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
    status: Order["status"]
): Promise<OrderWithItems | null> {
    if (!UUID_REGEX.test(orderId.trim())) {
        return null;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        await client.query(
            `UPDATE orders 
       SET status = $3, updated_at = NOW() 
       WHERE org_id = $1 AND id = $2`,
            [orgId, orderId.trim(), status]
        );

        await insertOrderStatusHistoryTransactional(
            client,
            orderId.trim(),
            status,
            "merchant"
        );

        await client.query("COMMIT");
        return getOrderById(orgId, orderId);
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

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
                 total::text AS total, delivery_type, customer_lat::text AS customer_lat,
                 customer_lng::text AS customer_lng, location_source,
                 location_accuracy_m::text AS location_accuracy_m, location_captured_at,
                 rider_name, rider_phone, delivery_fee::text AS delivery_fee,
                 delivery_fee_status, delivery_confirmation_code,
                 amount_collected::text AS amount_collected, collected_by, delivered_at,
                 created_at, updated_at`,
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

export async function findNearbyConfirmedOrders(
    orgId: string,
    targetOrderId: string,
    radiusKm = 2.0
): Promise<NearbyOrderRow[]> {
    const target = await getOrderById(orgId, targetOrderId);
    if (!target || !target.customer_lat || !target.customer_lng) {
        return [];
    }

    const targetLat = parseFloat(target.customer_lat);
    const targetLng = parseFloat(target.customer_lng);

    const result = await query<{
        id: string;
        customer_name: string;
        customer_phone: string;
        delivery_location: string;
        total: string;
        customer_lat: string;
        customer_lng: string;
    }>(
        `SELECT id, customer_name, customer_phone, delivery_location, total::text AS total,
            customer_lat::text AS customer_lat, customer_lng::text AS customer_lng
     FROM   orders
     WHERE  org_id = $1
       AND  id != $2
       AND  status = 'confirmed'
       AND  delivery_type = 'delivery'
       AND  customer_lat IS NOT NULL
       AND  customer_lng IS NOT NULL`,
        [orgId, targetOrderId]
    );

    const nearby: NearbyOrderRow[] = [];

    for (const row of result.rows) {
        const lat = parseFloat(row.customer_lat);
        const lng = parseFloat(row.customer_lng);
        const dist = computeHaversineDistanceKm(targetLat, targetLng, lat, lng);
        if (dist <= radiusKm) {
            nearby.push({
                id: row.id,
                customer_name: row.customer_name,
                customer_phone: row.customer_phone,
                delivery_location: row.delivery_location,
                total: row.total,
                customer_lat: lat,
                customer_lng: lng,
                distance_km: dist
            });
        }
    }

    nearby.sort((a, b) => a.distance_km - b.distance_km);
    return nearby;
}

export async function assignRiderToOrders(
    orgId: string,
    orderIds: string[],
    riderName: string,
    riderPhone: string
): Promise<Order[]> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const result = await client.query<Order>(
            `UPDATE orders
       SET    status = 'assigned',
              rider_name = $3,
              rider_phone = $4,
              updated_at = NOW()
       WHERE  org_id = $1
         AND  id = ANY($2::uuid[])
         AND  status = 'confirmed'
       RETURNING id, org_id, store_id, customer_name, customer_phone, customer_email,
                 delivery_location, notes, status, payment_method, payment_status,
                 total::text AS total, delivery_type, customer_lat::text AS customer_lat,
                 customer_lng::text AS customer_lng, location_source,
                 location_accuracy_m::text AS location_accuracy_m, location_captured_at,
                 rider_name, rider_phone, delivery_fee::text AS delivery_fee,
                 delivery_fee_status, delivery_confirmation_code,
                 amount_collected::text AS amount_collected, collected_by, delivered_at,
                 created_at, updated_at`,
            [orgId, orderIds, riderName.trim(), riderPhone.trim()]
        );

        for (const order of result.rows) {
            await insertOrderStatusHistoryTransactional(
                client,
                order.id,
                "assigned",
                "merchant"
            );
        }

        await client.query("COMMIT");
        return result.rows;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

// ---------------------------------------------------------------------------
// Delivery Handover Proof & Cash Reconciliation Queries
// ---------------------------------------------------------------------------

export async function completeOrderDeliveryTransactional(
    orgId: string,
    orderId: string,
    input: {
        confirmationCode?: string;
        amountCollected?: number;
        collectedBy?: string;
    }
): Promise<OrderWithItems> {
    if (!UUID_REGEX.test(orderId.trim())) {
        throw new AppError("Invalid order ID format", 400);
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const order = await getOrderById(orgId, orderId.trim());
        if (!order) {
            throw new AppError("Order not found", 404);
        }

        if (order.status === "delivered") {
            await client.query("COMMIT");
            return order;
        }

        // Validate 4-digit confirmation code if this is a doorstep delivery
        if (
            order.delivery_type === "delivery" &&
            order.delivery_confirmation_code
        ) {
            const expected = normalizeDeliveryConfirmationCode(
                order.delivery_confirmation_code
            );
            const provided = normalizeDeliveryConfirmationCode(
                input.confirmationCode || ""
            );

            if (!provided || provided !== expected) {
                throw new AppError(
                    "Invalid delivery confirmation code. Please check the 4-digit code provided by the customer.",
                    400
                );
            }
        }

        const isCOD = order.payment_method === "mpesa_cash";
        const orderTotalNum = parseFloat(order.total);
        const collectedAmount =
            input.amountCollected !== undefined
                ? input.amountCollected
                : isCOD
                  ? orderTotalNum
                  : orderTotalNum;
        const collector =
            input.collectedBy?.trim() || order.rider_name || "merchant";

        // Update Order to Delivered
        await client.query<Order>(
            `UPDATE orders
       SET    status           = 'delivered',
              delivered_at     = NOW(),
              amount_collected = $3,
              collected_by     = $4,
              payment_status   = (CASE WHEN $5 = TRUE THEN 'paid' ELSE payment_status END),
              updated_at       = NOW()
       WHERE  org_id = $1 AND id = $2
       RETURNING id, org_id, store_id, customer_name, customer_phone, customer_email,
                 delivery_location, notes, status, payment_method, payment_status,
                 total::text AS total, delivery_type, customer_lat::text AS customer_lat,
                 customer_lng::text AS customer_lng, location_source,
                 location_accuracy_m::text AS location_accuracy_m, location_captured_at,
                 rider_name, rider_phone, delivery_fee::text AS delivery_fee,
                 delivery_fee_status, delivery_confirmation_code,
                 amount_collected::text AS amount_collected, collected_by, delivered_at,
                 created_at, updated_at`,
            [
                orgId,
                orderId.trim(),
                collectedAmount,
                collector,
                isCOD && collectedAmount >= orderTotalNum
            ]
        );

        //    const updatedOrder = updateRes.rows[0];

        // Audit Trail entry
        await insertOrderStatusHistoryTransactional(
            client,
            orderId.trim(),
            "delivered",
            collector
        );

        // If Cash on Delivery was collected, record into financial ledger
        if (isCOD && collectedAmount > 0 && order.customer_phone) {
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
                await recordTransaction(client, {
                    orgId,
                    customerId,
                    type: "sale",
                    amount: orderTotalNum,
                    description: `Delivered Order #${order.id.slice(0, 8)}`,
                    createdBy: null
                });

                await recordTransaction(client, {
                    orgId,
                    customerId,
                    type: "payment",
                    amount: collectedAmount,
                    description: `Cash Collected on Delivery (${collector})`,
                    createdBy: null
                });
            }
        }

        await client.query("COMMIT");
        const fullOrder = await getOrderById(orgId, orderId);
        return fullOrder!;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

export async function getCashReconciliationSummary(
    orgId: string,
    startDate?: string,
    endDate?: string
): Promise<CashReconciliationSummary> {
    const conditions: string[] = [
        "org_id = $1",
        "payment_method = 'mpesa_cash'"
    ];
    const params: unknown[] = [orgId];
    let paramIdx = 2;

    if (startDate) {
        conditions.push(`created_at >= $${paramIdx}`);
        params.push(startDate);
        paramIdx++;
    }

    if (endDate) {
        conditions.push(`created_at <= $${paramIdx}`);
        params.push(endDate);
        paramIdx++;
    }

    const whereClause = conditions.join(" AND ");

    const result = await query<{
        total_cod_orders: string;
        delivered_cod_orders: string;
        expected_total: string;
        collected_total: string;
        unreconciled_count: string;
    }>(
        `SELECT
       COUNT(*)::text AS total_cod_orders,
       COUNT(*) FILTER (WHERE status = 'delivered')::text AS delivered_cod_orders,
       COALESCE(SUM(total), 0)::text AS expected_total,
       COALESCE(SUM(amount_collected) FILTER (WHERE status = 'delivered'), 0)::text AS collected_total,
       COUNT(*) FILTER (WHERE status = 'delivered' AND (amount_collected IS NULL OR amount_collected < total))::text AS unreconciled_count
     FROM orders
     WHERE ${whereClause}`,
        params
    );

    const row = result.rows[0];
    const expected = parseFloat(row?.expected_total || "0");
    const collected = parseFloat(row?.collected_total || "0");
    const variance = (expected - collected).toFixed(2);

    return {
        total_cod_orders: parseInt(row?.total_cod_orders || "0", 10),
        delivered_cod_orders: parseInt(row?.delivered_cod_orders || "0", 10),
        expected_total: row?.expected_total || "0.00",
        collected_total: row?.collected_total || "0.00",
        variance,
        unreconciled_count: parseInt(row?.unreconciled_count || "0", 10)
    };
}
