// =============================================================================
// src/modules/public/public.service.ts
// =============================================================================

import { z } from 'zod';
import { pool } from '../../config/db';
import { AppError } from '../../utils/error';
import * as publicQueries from './public.queries';
import * as ordersQueries from '../orders/orders.queries';

export const CheckoutSchema = z.object({
  customerName: z.string().min(1, 'Name is required').max(200),
  customerPhone: z.string().min(1, 'Phone is required').max(20),
  customerEmail: z.string().email('Invalid email').nullable().optional(),
  deliveryLocation: z.string().min(1, 'Delivery location is required').max(500),
  notes: z.string().max(1000).nullable().optional(),
  paymentMethod: z.string().min(1, 'Payment method selection is required'),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().positive('Quantity must be greater than zero'),
    })
  ).min(1, 'Cannot checkout with an empty cart'),
});

export interface PublicStoreDto {
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  location: string | null;
  delivery_info: string | null;
  hero_layout: string;
  hero_headline: string | null;
  hero_subheadline: string | null;
  hero_cta_label: string | null;
}

export interface PublicProductDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  images: string[];
  category: { name: string };
  availability: 'in_stock' | 'out_of_stock';
}

export interface PublicOrderConfirmation {
  orderId: string;
  customerName: string;
  total: number;
  status: string;
  items: Array<{
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
}

function toPublicStoreDto(row: publicQueries.PublicStoreRow): PublicStoreDto {
  return {
    name: row.name,
    description: row.description,
    logo_url: row.logo_url,
    cover_image_url: row.cover_image_url,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    location: row.location,
    delivery_info: row.delivery_info,
    hero_layout: row.hero_layout ?? 'editorial',
    hero_headline: row.hero_headline,
    hero_subheadline: row.hero_subheadline,
    hero_cta_label: row.hero_cta_label,
  };
}

function toPublicProductDto(row: publicQueries.PublicProductRow): PublicProductDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: parseFloat(row.price),
    stock: row.stock,
    images: row.images,
    category: { name: row.category_name },
    availability: row.stock > 0 ? 'in_stock' : 'out_of_stock',
  };
}

export async function getStoreMetadata(storeSlug: string): Promise<PublicStoreDto> {
  const store = await publicQueries.getStoreBySlugPublic(storeSlug);
  if (!store) throw new AppError('Store not found', 404);
  return toPublicStoreDto(store);
}

export async function listStoreProducts(storeSlug: string): Promise<PublicProductDto[]> {
  const store = await publicQueries.getStoreBySlugPublic(storeSlug);
  if (!store) throw new AppError('Store not found', 404);
  const products = await publicQueries.getProductsByStoreOrgIdPublic(store.org_id);
  return products.map(toPublicProductDto);
}

export async function getProductDetails(storeSlug: string, productSlug: string): Promise<PublicProductDto> {
  const store = await publicQueries.getStoreBySlugPublic(storeSlug);
  if (!store) throw new AppError('Store not found', 404);
  const product = await publicQueries.getProductBySlugPublic(store.org_id, productSlug);
  if (!product) throw new AppError('Product not found', 404);
  return toPublicProductDto(product);
}

export async function placeOrder(storeSlug: string, rawBody: unknown): Promise<{ orderId: string }> {
  const parsed = CheckoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid checkout information', 400);
  }

  const { items, ...customerData } = parsed.data;

  const store = await publicQueries.getStoreBySlugPublic(storeSlug);
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let calculatedTotal = 0;
    const itemsToInsert = [];

    for (const cartItem of items) {
      const productRes = await client.query<{ id: string; name: string; price: string; status: string; stock: number }>(
        `SELECT p.id, p.name, p.price::text AS price, p.status, i.stock
         FROM   products p
         INNER  JOIN inventory i ON i.product_id = p.id
         WHERE  p.id = $1 AND p.org_id = $2 AND p.deleted_at IS NULL`,
        [cartItem.product_id, store.org_id]
      );

      const product = productRes.rows[0];
      if (!product || product.status !== 'published') {
        throw new AppError('One of the products in your cart is no longer available.', 400);
      }

      if (product.stock < cartItem.quantity) {
        throw new AppError(`Insufficient stock remaining for ${product.name}`, 409);
      }

      const unitPrice = parseFloat(product.price);
      // Precision rounding for subtotal calculation
      const subtotal = Math.round(unitPrice * cartItem.quantity * 100) / 100;
      calculatedTotal += subtotal;

      itemsToInsert.push({
        productId: product.id,
        productName: product.name,
        unitPrice,
        quantity: cartItem.quantity,
        subtotal,
      });
    }

    calculatedTotal = Math.round(calculatedTotal * 100) / 100;

    const orderId = await ordersQueries.insertOrderTransactional(client, {
      orgId: store.org_id,
      storeId: store.id,
      customerName: customerData.customerName,
      customerPhone: customerData.customerPhone,
      customerEmail: customerData.customerEmail,
      deliveryLocation: customerData.deliveryLocation,
      notes: customerData.notes,
      paymentMethod: customerData.paymentMethod,
      total: calculatedTotal,
    });

    for (const item of itemsToInsert) {
      await ordersQueries.insertOrderItemTransactional(client, orderId, item);
      
      const success = await ordersQueries.decrementStockTransactional(client, item.productId, item.quantity);
      if (!success) {
        throw new AppError(`Stock was checked out concurrently by another shopper for ${item.productName}.`, 409);
      }
    }

    await client.query('COMMIT');
    return { orderId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPublicOrderDetails(storeSlug: string, orderId: string): Promise<PublicOrderConfirmation> {
  const store = await publicQueries.getStoreBySlugPublic(storeSlug);
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const orderRes = await pool.query<any>(
    `SELECT id, customer_name, total::text AS total, status 
     FROM   orders 
     WHERE  id = $1 AND org_id = $2`,
    [orderId, store.org_id]
  );
  const order = orderRes.rows[0];
  if (!order) {
    throw new AppError('Order confirmation details not found', 404);
  }

  const itemsRes = await pool.query<any>(
    `SELECT product_name, unit_price::text AS unit_price, quantity, subtotal::text AS subtotal
     FROM   order_items
     WHERE  order_id = $1`,
    [orderId]
  );

  return {
    orderId: order.id,
    customerName: order.customer_name,
    total: parseFloat(order.total),
    status: order.status,
    items: itemsRes.rows.map(row => ({
      productName: row.product_name,
      unitPrice: parseFloat(row.unit_price),
      quantity: row.quantity,
      subtotal: parseFloat(row.subtotal),
    })),
  };
}