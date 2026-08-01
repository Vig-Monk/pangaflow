// =============================================================================
// src/verticals/market/agent.service.ts
// Business logic for the agent errand vertical. Validates input via Zod,
// delegates to agent.queries.ts.
// =============================================================================

import { z } from 'zod';
import { AppError } from '../../utils/error';
import {
AgentClient,
AgentDashboard,
AgentOrder,
AgentOrderStatus,
createAgentClient,
createAgentOrder,
getAgentDashboard,
getTodayOrders,
listAgentClients,
updateOrderStatus,
} from './agent.queries';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const CreateAgentClientSchema = z.object({
name: z.string().min(1, 'Name is required').max(200),
phone: z.string().min(1, 'Phone is required').max(20),
deliveryAddress: z.string().min(1, 'Delivery address is required').max(500),
regularItems: z.array(z.unknown()).optional(),
notes: z.string().max(2000).optional(),
});

export const CreateAgentOrderSchema = z.object({
clientId: z.string().uuid(),
items: z.array(z.unknown()).min(1, 'At least one item is required'),
serviceFee: z.number().nonnegative(),
deliveryAddress: z.string().min(1, 'Delivery address is required').max(500),
specialNotes: z.string().max(2000).optional(),
orderDate: z.string().optional(),
});

const AGENT_ORDER_STATUSES = [
'pending',
'confirmed',
'buying',
'delivering',
'done',
'cancelled',
] as const;

export const UpdateOrderStatusSchema = z.object({
status: z.enum(AGENT_ORDER_STATUSES),
produceCost: z.number().nonnegative().optional(),
markupTotal: z.number().nonnegative().optional(),
totalCollected: z.number().nonnegative().optional(),
paymentMethod: z.string().max(50).optional(),
mpesaRef: z.string().max(50).optional(),
});

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function addClient(orgId: string, rawBody: unknown): Promise < AgentClient > {
const parsed = CreateAgentClientSchema.safeParse(rawBody);
if (!parsed.success) {
throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
}
return createAgentClient(orgId, parsed.data);
}

export async function listClients(orgId: string): Promise < AgentClient[] > {
return listAgentClients(orgId);
}

export async function addOrder(orgId: string, rawBody: unknown): Promise < AgentOrder > {
const parsed = CreateAgentOrderSchema.safeParse(rawBody);
if (!parsed.success) {
throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
}
return createAgentOrder(orgId, parsed.data);
}

export async function todayOrders(orgId: string): Promise < AgentOrder[] > {
return getTodayOrders(orgId);
}

export async function updateStatus(
orgId: string,
orderId: string,
rawBody: unknown
): Promise < AgentOrder > {
const parsed = UpdateOrderStatusSchema.safeParse(rawBody);
if (!parsed.success) {
throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
}

const { status, ...extraFields } = parsed.data;

// Map the validated camelCase body to the snake_case AgentOrder fields
// updateOrderStatus's `extra` parameter expects.
const extra: Partial < AgentOrder > = {};
if (extraFields.produceCost !== undefined) extra.produce_cost = String(extraFields.produceCost);
if (extraFields.markupTotal !== undefined) extra.markup_total = String(extraFields.markupTotal);
if (extraFields.totalCollected !== undefined) extra.total_collected = String(extraFields.totalCollected);
if (extraFields.paymentMethod !== undefined) extra.payment_method = extraFields.paymentMethod;
if (extraFields.mpesaRef !== undefined) extra.mpesa_ref = extraFields.mpesaRef;
if (status === 'done') extra.delivered_at = new Date();

const updated = await updateOrderStatus(
orgId,
orderId,
status as AgentOrderStatus,
extra
);

if (!updated) {
throw new AppError('Order not found', 404);
}

return updated;
}

export async function dashboard(orgId: string): Promise < AgentDashboard > {
return getAgentDashboard(orgId);
}