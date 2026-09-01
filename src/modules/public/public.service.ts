// =============================================================================
// soko-api/src/modules/public/public.service.ts
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
import { createPendingMpesaTransaction, findRecentPendingMpesaTransaction } from '../payments/payments.queries';

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
  mpesaCode: z.string().max(50).nullable().optional(),
  paymentMethod: z.string().min(1, 'Payment method selection is required'),
  deliveryType: z.enum(['delivery', 'pickup']).default('delivery'),
  customerLat: z.number().nullable().optional(),
  customerLng: z.number().nullable().optional(),
  locationSource: z.enum(['gps', 'local_list', 'nominatim', 'manual_text']).optional(),
  locationAccuracyM: z.number().nullable().optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      format_id: z.string().uuid().nullable().optional(),
      variant_id: z.string().uuid().nullable().optional(),
      quantity: z.number().int().positive('Quantity must be greater than zero'),
      delivery_method: z.enum(['digital', 'pickup', 'delivery']).optional(),
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

export interface PublicFormatDto {
  id: string;
  product_id: string;
  format: 'pdf' | 'epub' | 'hardcopy';
  price: number;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: number | null;
  stock: number | null;
}

export interface PublicProductDto {
  id: string;
  org_id: string;
  category_id: string;
  category_name: string;
  name: string;
  slug: string;
  sku: string | null;
  author: string | null;
  description: string | null;
  price: number;
  stock: number;
  images: Array<{ image_url: string; image_public_id?: string; sort_order?: number }>;
  formats: PublicFormatDto[];
  created_at: string;
  updated_at: string;
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
    variantTitle?: string | null;
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
  const formats: PublicFormatDto[] = (row.formats || []).map((f) => ({
    id: f.id,
    product_id: f.product_id,
    format: f.format,
    price: parseFloat(f.price),
    file_url: f.file_url,
    file_public_id: f.file_public_id,
    file_size_bytes: f.file_size_bytes ? parseInt(f.file_size_bytes, 10) : null,
    stock: f.stock,
  }));

  const hardcopyFormat = formats.find((f) => f.format === 'hardcopy');
  const totalStock = hardcopyFormat ? (hardcopyFormat.stock ?? 0) : row.stock;

  const normalizedImages = (row.images || [])
    .map((img: any, idx: number) => {
      if (typeof img === 'string') return { image_url: img, image_public_id: `img_${idx}`, sort_order: idx };
      if (img && typeof img === 'object' && img.image_url) return img;
      return null;
    })
    .filter(Boolean);

  let author: string | null = null;
  if (row.description && row.description.startsWith('By ')) {
    const match = row.description.match(/^By\s+([^<\n]+)/);
    author = match ? match[1].trim() : null;
  }

  return {
    id: row.id,
    org_id: row.org_id,
    category_id: row.category_id,
    category_name: row.category_name || 'General',
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    author,
    description: row.description,
    price: parseFloat(row.price),
    stock: totalStock,
    images: normalizedImages,
    formats,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
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

  const { items, mpesaCode, ...customerData } = parsed.data;

  const normalizedSlug = (storeSlug || '').trim().toLowerCase();
  const store = await publicQueries.getStoreBySlugPublic(normalizedSlug);
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const isAutomatedDaraja = customerData.paymentMethod === 'mpesa' || customerData.paymentMethod === 'mpesa_direct';

  if (isAutomatedDaraja) {
    const creds = await getCredentialsRowByOrgId(store.org_id);
    if (!creds || creds.status !== 'verified') {
      throw new AppError("This store hasn't finished setting up automated payments yet", 503);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cleanPhone = normalizeCustomerPhone(customerData.customerPhone);

    const existingCustomer = await client.query<{ id: string }>(
      `SELECT id FROM customers WHERE org_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
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
    }

    let calculatedProductsSubtotal = 0;
    let hasPhysicalItem = false;
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

      let unitPrice = parseFloat(product.price);
      let costPrice = parseFloat(product.cost_price || '0');
      let variantTitle: string | null = null;
      let deliveryMethod: string = cartItem.delivery_method || 'delivery';
      let isPhysical = false;

      if (cartItem.format_id) {
        const formatRes = await client.query<{
          id: string;
          format: 'pdf' | 'epub' | 'hardcopy';
          price: string;
          stock: number | null;
        }>(
          `SELECT id, format, price::text AS price, stock
           FROM   product_formats
           WHERE  id = $1 AND product_id = $2`,
          [cartItem.format_id, product.id]
        );

        const formatRow = formatRes.rows[0];
        if (!formatRow) {
          throw new AppError(`Selected format for "${product.name}" is no longer available.`, 400);
        }

        unitPrice = parseFloat(formatRow.price);
        variantTitle = formatRow.format.toUpperCase();

        if (formatRow.format === 'hardcopy') {
          hasPhysicalItem = true;
          isPhysical = true;
          deliveryMethod = customerData.deliveryType || 'delivery';
          if (formatRow.stock !== null && formatRow.stock < cartItem.quantity) {
            throw new AppError(`Insufficient stock remaining for "${product.name}". Only ${formatRow.stock} physical copies left.`, 409);
          }
        } else {
          deliveryMethod = 'digital';
          isPhysical = false;
        }
      } else {
        hasPhysicalItem = true;
        isPhysical = true;
        deliveryMethod = customerData.deliveryType || 'delivery';
        if (product.stock < cartItem.quantity) {
          throw new AppError(`Insufficient stock remaining for "${product.name}". Only ${product.stock} left.`, 409);
        }
      }

      const subtotal = Math.round(unitPrice * cartItem.quantity * 100) / 100;
      calculatedProductsSubtotal += subtotal;

      itemsToInsert.push({
        productId: product.id,
        formatId: cartItem.format_id || null,
        variantId: cartItem.variant_id || null,
        variantTitle,
        productName: product.name,
        unitPrice,
        costPrice,
        quantity: cartItem.quantity,
        subtotal,
        deliveryMethod,
        isPhysical,
      });
    }

    calculatedProductsSubtotal = Math.round(calculatedProductsSubtotal * 100) / 100;

    const isDelivery = hasPhysicalItem && customerData.deliveryType !== 'pickup';
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

    let finalNotes = customerData.notes?.trim() || '';
    if (mpesaCode && mpesaCode.trim()) {
      const codeNote = `[M-Pesa Reference: ${mpesaCode.trim().toUpperCase()}]`;
      finalNotes = finalNotes ? `${codeNote} ${finalNotes}` : codeNote;
    }

    const orderId = await ordersQueries.insertOrderTransactional(client, {
      orgId: store.org_id,
      storeId: store.id,
      customerName: customerData.customerName.trim(),
      customerPhone: cleanPhone,
      customerEmail: customerData.customerEmail?.trim() || null,
      deliveryLocation: customerData.deliveryLocation,
      notes: finalNotes || null,
      paymentMethod: customerData.paymentMethod,
      total: finalOrderTotal,
      deliveryType: hasPhysicalItem ? customerData.deliveryType : 'delivery',
      customerLat: customerData.customerLat,
      customerLng: customerData.customerLng,
      locationSource: customerData.locationSource,
      locationAccuracyM: customerData.locationAccuracyM,
      deliveryFee,
      deliveryFeeStatus,
      deliveryConfirmationCode: confirmationCode,
    });

    await ordersQueries.insertOrderStatusHistoryTransactional(client, orderId, 'pending', 'system');

    for (const item of itemsToInsert) {
      await ordersQueries.insertOrderItemTransactional(client, orderId, {
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        variantId: item.variantId,
        variantTitle: item.variantTitle,
        formatId: item.formatId,
        deliveryMethod: item.deliveryMethod,
      });

      if (item.isPhysical) {
        if (item.formatId) {
          const decFormatRes = await client.query(
            `UPDATE product_formats
             SET    stock = stock - $1, updated_at = NOW()
             WHERE  id = $2 AND format = 'hardcopy' AND (stock IS NULL OR stock >= $1)`,
            [item.quantity, item.formatId]
          );
          if (decFormatRes.rowCount === 0) {
            throw new AppError(`The hardcopy edition of "${item.productName}" was just sold out.`, 409);
          }
          await ordersQueries.decrementStockTransactional(client, item.productId, item.quantity);
        } else {
          await ordersQueries.decrementStockTransactional(client, item.productId, item.quantity);
        }
      }
    }

    let checkoutRequestId: string | undefined;

   if  (isAutomatedDaraja) {
      const recentPending = await findRecentPendingMpesaTransaction(orderId, 60);

      if (recentPending) {
        checkoutRequestId = recentPending.checkout_request_id;
      } else {
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
  orderId: string,
  verifyingPhone?: string
): Promise<PublicOrderConfirmation & { downloads: any[]; isVerifiedCustomer: boolean; notes: string | null }> {
  const normalizedSlug = (storeSlug || '').trim().toLowerCase();
  const store = await publicQueries.getStoreBySlugPublic(normalizedSlug);
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const orderRes = await pool.query<publicQueries.PublicOrderDetailsRow & { notes: string | null }>(
    `SELECT o.id, o.customer_name, o.customer_phone, o.total::text AS total, o.status,
            o.payment_method, o.payment_status, o.notes,
            o.delivery_type, o.delivery_fee::text AS delivery_fee,
            o.delivery_fee_status, o.delivery_confirmation_code,
            o.delivery_location,
            mt.mpesa_receipt_number, mt.checkout_request_id
     FROM   orders o
     LEFT JOIN mpesa_transactions mt 
            ON mt.account_reference = o.id::text 
           AND mt.status = 'completed'
     WHERE  o.id = $1 AND o.org_id = $2
     ORDER BY mt.created_at DESC
     LIMIT 1`,
    [orderId, store.org_id]
  );

  const order = orderRes.rows[0];
  if (!order) {
    throw new AppError('Order confirmation details not found', 404);
  }

  const items = await publicQueries.getPublicOrderItems(order.id);

  const cleanVerifying = verifyingPhone ? normalizeCustomerPhone(verifyingPhone) : null;
  const isVerifiedCustomer = Boolean(cleanVerifying && cleanVerifying === normalizeCustomerPhone(order.customer_phone));

  let downloads: any[] = [];
  if (order.payment_status === 'paid') {
    const downloadsRes = await pool.query<{
      token: string;
      max_downloads: number;
      download_count: number;
      expires_at: Date;
      format: string;
      book_title: string;
    }>(
      `SELECT dd.download_token AS token,
              dd.max_downloads,
              dd.download_count,
              dd.expires_at,
              pf.format,
              p.name AS book_title
       FROM digital_downloads dd
       INNER JOIN product_formats pf ON pf.id = dd.format_id
       INNER JOIN products p ON p.id = pf.product_id
       INNER JOIN order_items oi ON oi.id = dd.order_item_id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    downloads = downloadsRes.rows.map((d) => ({
      bookTitle: d.book_title,
      format: d.format,
      token: d.token,
      downloadUrl: `/api/v1/books/download/${d.token}?redirect=true`,
      expiresAt: d.expires_at.toISOString(),
      maxDownloads: d.max_downloads,
      downloadCount: d.download_count,
    }));
  }

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
    notes: order.notes,
    items: items.map((row: publicQueries.PublicOrderItemRow) => ({
      productName: row.product_name,
      variantTitle: row.variant_title || null,
      unitPrice: parseFloat(row.unit_price),
      quantity: row.quantity,
      subtotal: parseFloat(row.subtotal),
    })),
    downloads,
    isVerifiedCustomer,
  };}
    