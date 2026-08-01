// =============================================================================
// src/verticals/market/agent.queries.ts
// Database access layer — Wakulima market agent errand module.
// Raw pg only. No business logic.
//
// This lives under src/verticals/, not src/modules/ — a vertical is a
// self-contained business-line extension (Wakulima procurement service),
// distinct from the core Lite platform modules (auth, customers,
// transactions). Same module boundary discipline applies: this file owns
// only agent_clients/agent_orders access, and agent.service.ts is the
// only cross-vertical entry point (per Section 23).
// =============================================================================

import { query } from '../../config/db';

// ---------------------------------------------------------------------------
// Interfaces — exact spec text
// ---------------------------------------------------------------------------

export interface AgentClient {
  id: string;
  org_id: string;
  name: string;
  phone: string;
  delivery_address: string;
  regular_items: unknown[];
  notes: string | null;
  created_at: Date;
}

export type AgentOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'buying'
  | 'delivering'
  | 'done'
  | 'cancelled';

export interface AgentOrder {
  id: string;
  org_id: string;
  client_id: string;
  items: unknown[];
  service_fee: string;
  produce_cost: string;
  markup_total: string;
  total_collected: string;
  status: AgentOrderStatus;
  delivery_address: string;
  special_notes: string | null;
  order_date: string;
  delivered_at: Date | null;
  payment_method: string | null;
  mpesa_ref: string | null;
  created_at: Date;
}

export interface AgentDashboard {
  today_earnings: string;
  pending_orders: number;
  weekly_total: string;
  monthly_revenue: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateAgentClientInput {
  name: string;
  phone: string;
  deliveryAddress: string;
  regularItems?: unknown[];
  notes?: string;
}

export interface CreateAgentOrderInput {
  clientId: string;
  items: unknown[];
  serviceFee: number;
  deliveryAddress: string;
  specialNotes?: string;
  orderDate?: string;
}

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

interface EarningsRow {
  earnings: string;
}

interface PendingCountRow {
  count: string;
}

// ---------------------------------------------------------------------------
// createAgentClient
// ---------------------------------------------------------------------------

export async function createAgentClient(
  orgId: string,
  data: CreateAgentClientInput
): Promise<AgentClient> {
  const result = await query<AgentClient>(
    `INSERT INTO agent_clients
       (org_id, name, phone, delivery_address, regular_items, notes)
     VALUES
       ($1, $2, $3, $4, $5, $6)
     RETURNING
       id, org_id, name, phone, delivery_address, regular_items, notes, created_at`,
    [
      orgId,
      data.name,
      data.phone,
      data.deliveryAddress,
      JSON.stringify(data.regularItems ?? []),
      data.notes ?? null,
    ]
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// listAgentClients
// ---------------------------------------------------------------------------

export async function listAgentClients(orgId: string): Promise<AgentClient[]> {
  const result = await query<AgentClient>(
    `SELECT id, org_id, name, phone, delivery_address, regular_items, notes, created_at
     FROM   agent_clients
     WHERE  org_id = $1
     ORDER  BY name ASC`,
    [orgId]
  );

  return result.rows;
}

// ---------------------------------------------------------------------------
// createAgentOrder
// ---------------------------------------------------------------------------

/**
 * Creates a new order at 'pending' status. Financial fields beyond
 * service_fee (produce_cost, markup_total, total_collected) start at 0 —
 * they are filled in via updateOrderStatus's `extra` parameter as the
 * order progresses through buying/delivering/done, since the actual
 * produce cost is unknown until the agent buys at market.
 */
export async function createAgentOrder(
  orgId: string,
  data: CreateAgentOrderInput
): Promise<AgentOrder> {
  const result = await query<AgentOrder>(
    `INSERT INTO agent_orders
       (org_id, client_id, items, service_fee, delivery_address,
        special_notes, order_date)
     VALUES
       ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE))
     RETURNING
       id, org_id, client_id, items,
       service_fee::text AS service_fee,
       produce_cost::text AS produce_cost,
       markup_total::text AS markup_total,
       total_collected::text AS total_collected,
       status, delivery_address, special_notes,
       order_date::text AS order_date,
       delivered_at, payment_method, mpesa_ref, created_at`,
    [
      orgId,
      data.clientId,
      JSON.stringify(data.items),
      data.serviceFee,
      data.deliveryAddress,
      data.specialNotes ?? null,
      data.orderDate ?? null,
    ]
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// getTodayOrders
// ---------------------------------------------------------------------------

/**
 * Returns every order whose order_date is today, regardless of status.
 * Filters on order_date, not created_at — an order created the evening
 * before for tomorrow's market run is deliberately excluded; an order
 * created days ago but still scheduled for today's run is included.
 */
export async function getTodayOrders(orgId: string): Promise<AgentOrder[]> {
  const result = await query<AgentOrder>(
    `SELECT
       id, org_id, client_id, items,
       service_fee::text AS service_fee,
       produce_cost::text AS produce_cost,
       markup_total::text AS markup_total,
       total_collected::text AS total_collected,
       status, delivery_address, special_notes,
       order_date::text AS order_date,
       delivered_at, payment_method, mpesa_ref, created_at
     FROM   agent_orders
     WHERE  org_id     = $1
       AND  order_date = CURRENT_DATE
     ORDER  BY created_at ASC`,
    [orgId]
  );

  return result.rows;
}

// ---------------------------------------------------------------------------
// updateOrderStatus
// ---------------------------------------------------------------------------

/**
 * Updates an order's status, optionally alongside any other AgentOrder
 * fields (produce_cost once known, total_collected once payment is in,
 * delivered_at when marking done, payment_method/mpesa_ref on payment).
 *
 * Returns null if the order does not exist in this org.
 *
 * Not wrapped in a pg transaction: this is a single-table update. Unlike
 * recordTransaction's balance_after (a running ledger value that must be
 * read-then-written atomically), these fields are independent outcome
 * data with no cross-row consistency requirement — Section 22's
 * transaction-safety rule applies to multi-table writes, which this is not.
 */
export async function updateOrderStatus(
  orgId: string,
  orderId: string,
  status: AgentOrderStatus,
  extra?: Partial<AgentOrder>
): Promise<AgentOrder | null> {
  // Whitelist of columns updateOrderStatus is allowed to touch via `extra`.
  // id, org_id, client_id, created_at are structurally immutable — never
  // accepted here even if present on the Partial<AgentOrder> type.
  const allowedColumns: Record<string, string> = {
    items: 'items',
    service_fee: 'service_fee',
    produce_cost: 'produce_cost',
    markup_total: 'markup_total',
    total_collected: 'total_collected',
    delivery_address: 'delivery_address',
    special_notes: 'special_notes',
    order_date: 'order_date',
    delivered_at: 'delivered_at',
    payment_method: 'payment_method',
    mpesa_ref: 'mpesa_ref',
  };

  const setClauses: string[] = ['status = $3'];
  const params: unknown[] = [orgId, orderId, status];
  let paramIndex = 4;

  if (extra) {
    for (const [key, column] of Object.entries(allowedColumns)) {
      if (key in extra) {
        const value = (extra as Record<string, unknown>)[key];
        setClauses.push(`${column} = $${paramIndex}`);
        params.push(
          key === 'items' && value !== null && value !== undefined
            ? JSON.stringify(value)
            : (value ?? null)
        );
        paramIndex++;
      }
    }
  }

  const result = await query<AgentOrder>(
    `UPDATE agent_orders
     SET    ${setClauses.join(', ')}
     WHERE  org_id = $1
       AND  id     = $2
     RETURNING
       id, org_id, client_id, items,
       service_fee::text AS service_fee,
       produce_cost::text AS produce_cost,
       markup_total::text AS markup_total,
       total_collected::text AS total_collected,
       status, delivery_address, special_notes,
       order_date::text AS order_date,
       delivered_at, payment_method, mpesa_ref, created_at`,
    params
  );

  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// getAgentDashboard
// ---------------------------------------------------------------------------

/**
 * Returns the agent's earnings summary. "Earnings" = service_fee +
 * markup_total (what the agent actually keeps), not total_collected
 * (which includes the produce_cost passed through to the client and
 * isn't the agent's income).
 *
 * All four metrics computed from order_date, consistent with
 * getTodayOrders — "today", "this week", "this month" all mean market
 * run scheduling date, not record-creation timestamp.
 */
export async function getAgentDashboard(orgId: string): Promise<AgentDashboard> {
  const [todayResult, pendingResult, weekResult, monthResult] = await Promise.all([
    query<EarningsRow>(
      `SELECT COALESCE(SUM(service_fee + markup_total), 0)::text AS earnings
       FROM   agent_orders
       WHERE  org_id     = $1
         AND  order_date = CURRENT_DATE
         AND  status     != 'cancelled'`,
      [orgId]
    ),

    query<PendingCountRow>(
      `SELECT COUNT(*)::text AS count
       FROM   agent_orders
       WHERE  org_id = $1
         AND  status IN ('pending', 'confirmed', 'buying', 'delivering')`,
      [orgId]
    ),

    query<EarningsRow>(
      `SELECT COALESCE(SUM(service_fee + markup_total), 0)::text AS earnings
       FROM   agent_orders
       WHERE  org_id     = $1
         AND  order_date >= CURRENT_DATE - INTERVAL '7 days'
         AND  order_date <= CURRENT_DATE
         AND  status     != 'cancelled'`,
      [orgId]
    ),

    query<EarningsRow>(
      `SELECT COALESCE(SUM(service_fee + markup_total), 0)::text AS earnings
       FROM   agent_orders
       WHERE  org_id = $1
         AND  date_trunc('month', order_date) = date_trunc('month', CURRENT_DATE)
         AND  status != 'cancelled'`,
      [orgId]
    ),
  ]);

  return {
    today_earnings: todayResult.rows[0]?.earnings ?? '0',
    pending_orders: parseInt(pendingResult.rows[0]?.count ?? '0', 10),
    weekly_total: weekResult.rows[0]?.earnings ?? '0',
    monthly_revenue: monthResult.rows[0]?.earnings ?? '0',
  };
}