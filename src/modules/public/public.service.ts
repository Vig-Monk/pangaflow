// =============================================================================
// src/modules/public/public.service.ts
// =============================================================================

import axios from 'axios';
import { z } from 'zod';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/error';
import { computeHaversineDistanceKm, calculateDeliveryFee } from '../../utils/geo';
import { generateDeliveryConfirmationCode } from '../../utils/crypto';
import * as publicQueries from './public.queries';
import * as ordersQueries from '../orders/orders.queries';
import { getCredentialsRowByOrgId, getDecryptedCredentials } from '../mpesa-credentials/mpesa-credentials.queries';
import * as darajaService from '../../services/daraja.service';
import { createPendingMpesaTransaction } from '../payments/payments.queries';

export interface LocationSearchResult {
  name: string;
  lat: number;
  lng: number;
  source: 'local_list' | 'nominatim';
  city?: string;
}

const nominatimCache = new Map<string, { data: LocationSearchResult[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
let lastNominatimCallTime = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1000;

function normalizeCustomerPhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    return `0${digits}`;
  }
  return digits.slice(0, 10);
}

async function fetchNominatimWithRateLimit(searchQuery: string): Promise<LocationSearchResult[]> {
  const cacheKey = searchQuery.trim().toLowerCase();
  const cached = nominatimCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const now = Date.now();
  const elapsed = now - lastNominatimCallTime;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed));
  }
  lastNominatimCallTime = Date.now();

  try {
    const response = await axios.get<Array<{ display_name: string; lat: string; lon: string }>>(
      'https://nominatim.openstreetmap.org/search',
      {
        params: {
          q: searchQuery,
          countrycodes: 'ke',
          format: 'json',
          limit: 5,
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'SokoApp-EACheckout/1.0 (support@soko.app)',
        },
        timeout: 5000,
      }
    );

    const results: LocationSearchResult[] = (response.data || [])
      .map((item) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        source: 'nominatim' as const,
      }))
      .filter((r) => !isNaN(r.lat) && !isNaN(r.lng));

    nominatimCache.set(cacheKey, {
      data: results,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return results;
  } catch (err) {
    console.warn('Nominatim fallback geocoding degraded gracefully:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function searchDeliveryLocations(rawQuery: unknown): Promise<LocationSearchResult[]> {
  const schema = z.object({
    q: z.string().min(1, 'Search query is required').max(100),
  });

  const parsed = schema.safeParse(rawQuery);
  if (!parsed.success) {
    return [];
  }

  const queryText = parsed.data.q.trim();
  const localEstates = await publicQueries.searchEstatesLocal(queryText);
  if (localEstates.length > 0) {
    return localEstates.map((estate: publicQueries.LocalEstateRow) => ({
      name: `${estate.name}, ${estate.city}`,
      lat: parseFloat(estate.lat),
      lng: parseFloat(estate.lng),
      city: estate.city,
      source: 'local_list' as const,
    }));
  }

  return fetchNominatimWithRateLimit(queryText);
}

export const CheckoutSchema = z.object({
  customerName: z.string().min(1, 'Name is required').max(200),
  customerPhone: z.string().min(1, 'Phone is required').max(20),
  customerEmail: z.string().email('Invalid email').nullable().optional().or(z.literal('')).transform(v => (v === '' ? null : v)),
  deliveryLocation: z.string().min(1, 'Delivery location is required').max(500),
  notes: z.string().max(1000).nullable().optional(),
  paymentMethod: z.string().min(1, 'Payment method selection is required'),
  deliveryType: z.enum(['delivery', 'pickup']).default('delivery'),
  customerLat: z.number().nullable().optional(),
  customerLng: z.number().nullable().optional(),
  locationSource: z.enum(['gps', 'local_list', 'nominatim', 'manual_text']).optional(),
  locationAccuracyM: z.number().nullable().optional(),
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
  mpesa_verified: boolean;
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
  status: 'pending' | 'confirmed' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  mpesaReceiptNumber: string | null;
  checkoutRequestId?: string | null;
  deliveryType: 'delivery' | 'pickup';
  deliveryFee: number;
  deliveryFeeStatus: 'known' | 'needs_merchant_confirmation';
  deliveryConfirmationCode: string | null;
  deliveryLocation: string;
  items: Array<{
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
}

function toPublicStoreDto(row: publicQueries.PublicStoreRow, mpesaVerified: boolean): PublicStoreDto {
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
    mpesa_verified: mpesaVerified,
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
    images: Array.isArray(row.images) ? row.images : [],
    category: { name: row.category_name || 'General' },
    availability: row.stock > 0 ? 'in_stock' : 'out_of_stock',
  };
}

export async function getStoreMetadata(storeSlug: string): Promise<PublicStoreDto> {
  const normalizedSlug = (storeSlug || '').trim().toLowerCase();
  const store = await publicQueries.getStoreBySlugPublic(normalizedSlug);
  if (!store) throw new AppError('Store not found', 404);

  let mpesaVerified = false;
  try {
    const creds = await getCredentialsRowByOrgId(store.org_id);
    mpesaVerified = creds?.status === 'verified';
  } catch {
    mpesaVerified = false;
  }

  return toPublicStoreDto(store, mpesaVerified);
}

export async function listStoreProducts(storeSlug: string): Promise<PublicProductDto[]> {
  const normalizedSlug = (storeSlug || '').trim().toLowerCase();
  const store = await publicQueries.getStoreBySlugPublic(normalizedSlug);
  if (!store) throw new AppError('Store not found', 404);
  const products = await publicQueries.getProductsByStoreOrgIdPublic(store.org_id);
  return products.map(toPublicProductDto);
}

export async function getProductDetails(storeSlug: string, productSlug: string): Promise<PublicProductDto> {
  const normalizedSlug = (storeSlug || '').trim().toLowerCase();
  const store = await publicQueries.getStoreBySlugPublic(normalizedSlug);
  if (!store) throw new AppError('Store not found', 404);
  const product = await publicQueries.getProductBySlugPublic(store.org_id, productSlug);
  if (!product) throw new AppError('Product not found', 404);
  return toPublicProductDto(product);
}

export async function placeOrder(
  storeSlug: string,
  rawBody: unknown
): Promise<{ orderId: string; checkoutRequestId?: string }> {
  const parsed = CheckoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid checkout information', 400);
  }

  const { items, ...customerData } = parsed.data;

  const normalizedSlug = (storeSlug || '').trim().toLowerCase();
  const store = await publicQueries.getStoreBySlugPublic(normalizedSlug);
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const isDirectMpesa = customerData.paymentMethod === 'mpesa' || customerData.paymentMethod === 'mpesa_direct';

  if (isDirectMpesa) {
    const creds = await getCredentialsRowByOrgId(store.org_id);
    if (!creds || creds.status !== 'verified') {
      throw new AppError("This store hasn't finished setting up payments yet", 503);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Auto-Sync & Deduplicate Shopper in Merchant's Customer CRM
    const cleanPhone = normalizeCustomerPhone(customerData.customerPhone);

    const existingCustomer = await client.query<{ id: string; email: string | null; address: string | null }>(
      `SELECT id, email, address FROM customers WHERE org_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
      [store.org_id, cleanPhone]
    );

    if (existingCustomer.rows.length === 0) {
      await client.query(
        `INSERT INTO customers (org_id, name, phone, email, address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          store.org_id,
          customerData.customerName.trim(),
          cleanPhone,
          customerData.customerEmail?.trim() || null,
          customerData.deliveryLocation || null,
        ]
      );
    } else {
      const existingId = existingCustomer.rows[0].id;
      await client.query(
        `UPDATE customers
         SET name = COALESCE(NULLIF($3, ''), name),
             email = COALESCE(email, $4),
             address = COALESCE(address, $5),
             updated_at = NOW()
         WHERE id = $1 AND org_id = $2`,
        [
          existingId,
          store.org_id,
          customerData.customerName.trim(),
          customerData.customerEmail?.trim() || null,
          customerData.deliveryLocation || null,
        ]
      );
    }

    // 2. Fetch Products & Snapshot Real Cost Price (COGS)
    let calculatedProductsSubtotal = 0;
    const itemsToInsert = [];

    for (const cartItem of items) {
      const productRes = await client.query<{
        id: string;
        name: string;
        price: string;
        cost_price: string | null;
        status: string;
        stock: number;
      }>(
        `SELECT p.id, p.name, p.price::text AS price, p.cost_price::text AS cost_price, p.status, i.stock
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
      const costPrice = parseFloat(product.cost_price || '0');
      const subtotal = Math.round(unitPrice * cartItem.quantity * 100) / 100;
      calculatedProductsSubtotal += subtotal;

      itemsToInsert.push({
        productId: product.id,
        productName: product.name,
        unitPrice,
        costPrice,
        quantity: cartItem.quantity,
        subtotal,
      });
    }

    calculatedProductsSubtotal = Math.round(calculatedProductsSubtotal * 100) / 100;

    // 3. Server-Authoritative Delivery Fee Math
    const isDelivery = customerData.deliveryType !== 'pickup';
    let deliveryFee = 0;
    let deliveryFeeStatus: 'known' | 'needs_merchant_confirmation' = 'known';
    let confirmationCode: string | null = null;

    if (isDelivery) {
      confirmationCode = generateDeliveryConfirmationCode();

      if (
        customerData.customerLat !== null &&
        customerData.customerLat !== undefined &&
        customerData.customerLng !== null &&
        customerData.customerLng !== undefined
      ) {
        const merchantLoc = await ordersQueries.getMerchantLocationTransactional(client, store.org_id);
        if (merchantLoc) {
          const merchantLat = parseFloat(merchantLoc.lat);
          const merchantLng = parseFloat(merchantLoc.lng);
          const distanceKm = computeHaversineDistanceKm(
            merchantLat,
            merchantLng,
            customerData.customerLat,
            customerData.customerLng
          );

          const feeCalc = calculateDeliveryFee(distanceKm, {
            baseFee: parseFloat(merchantLoc.base_delivery_fee),
            feePerKm: parseFloat(merchantLoc.fee_per_km),
            maxDeliveryRadiusKm: parseFloat(merchantLoc.max_delivery_radius_km),
          });

          deliveryFee = feeCalc.fee;
          deliveryFeeStatus = feeCalc.status;
        } else {
          deliveryFee = 0;
          deliveryFeeStatus = 'needs_merchant_confirmation';
        }
      } else {
        deliveryFee = 0;
        deliveryFeeStatus = 'needs_merchant_confirmation';
      }
    } else {
      deliveryFee = 0;
      deliveryFeeStatus = 'known';
      confirmationCode = null;
    }

    const finalOrderTotal = Math.round((calculatedProductsSubtotal + deliveryFee) * 100) / 100;

    // 4. Insert Transactional Order
    const orderId = await ordersQueries.insertOrderTransactional(client, {
      orgId: store.org_id,
      storeId: store.id,
      customerName: customerData.customerName.trim(),
      customerPhone: cleanPhone,
      customerEmail: customerData.customerEmail?.trim() || null,
      deliveryLocation: customerData.deliveryLocation,
      notes: customerData.notes,
      paymentMethod: customerData.paymentMethod,
      total: finalOrderTotal,
      deliveryType: customerData.deliveryType,
      customerLat: customerData.customerLat,
      customerLng: customerData.customerLng,
      locationSource: customerData.locationSource,
      locationAccuracyM: customerData.locationAccuracyM,
      deliveryFee,
      deliveryFeeStatus,
      deliveryConfirmationCode: confirmationCode,
    });

    await ordersQueries.insertOrderStatusHistoryTransactional(client, orderId, 'pending', 'system');

    // 5. Insert Snapshot Line Items with COGS & Decrement Stock
    for (const item of itemsToInsert) {
      await ordersQueries.insertOrderItemTransactional(client, orderId, item);

      const success = await ordersQueries.decrementStockTransactional(client, item.productId, item.quantity);
      if (!success) {
        throw new AppError(`Stock was checked out concurrently by another shopper for ${item.productName}.`, 409);
      }
    }

    // 6. Direct M-Pesa STK Trigger (If Selected)
    let checkoutRequestId: string | undefined;

    if (isDirectMpesa) {
      const decryptedCreds = await getDecryptedCredentials(store.org_id);
      if (decryptedCreds) {
        const callbackUrl = `${env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/payments/mpesa/callback`;
        const stkResult = await darajaService.stkPush({
          credentials: decryptedCreds,
          phone: cleanPhone,
          amount: finalOrderTotal,
          accountReference: orderId,
          transactionDesc: `Order ${orderId.slice(0, 8)}`,
          callbackUrl,
        });

        checkoutRequestId = stkResult.checkoutRequestId;

        await createPendingMpesaTransaction(client, {
          orgId: store.org_id,
          checkoutRequestId: stkResult.checkoutRequestId,
          merchantRequestId: stkResult.merchantRequestId,
          phone: cleanPhone,
          amount: finalOrderTotal,
          accountReference: orderId,
          transactionDesc: `Order ${orderId.slice(0, 8)}`,
        });
      }
    }

    await client.query('COMMIT');
    return { orderId, checkoutRequestId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getPublicOrderDetails(
  storeSlug: string,
  orderId: string
): Promise<PublicOrderConfirmation> {
  const normalizedSlug = (storeSlug || '').trim().toLowerCase();
  const store = await publicQueries.getStoreBySlugPublic(normalizedSlug);
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const order = await publicQueries.getPublicOrderDetailsRow(store.org_id, orderId);
  if (!order) {
    throw new AppError('Order confirmation details not found', 404);
  }

  const items = await publicQueries.getPublicOrderItems(order.id);

  return {
    orderId: order.id,
    customerName: order.customer_name,
    total: parseFloat(order.total),
    status: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    mpesaReceiptNumber: order.mpesa_receipt_number,
    checkoutRequestId: order.checkout_request_id,
    deliveryType: order.delivery_type,
    deliveryFee: parseFloat(order.delivery_fee || '0'),
    deliveryFeeStatus: order.delivery_fee_status,
    deliveryConfirmationCode: order.delivery_confirmation_code,
    deliveryLocation: order.delivery_location,
    items: items.map((row: publicQueries.PublicOrderItemRow) => ({
      productName: row.product_name,
      unitPrice: parseFloat(row.unit_price),
      quantity: row.quantity,
      subtotal: parseFloat(row.subtotal),
    })),
  };
}