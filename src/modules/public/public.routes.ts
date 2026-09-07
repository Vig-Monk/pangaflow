// =============================================================================
// soko-api/src/modules/public/public.routes.ts
// Public storefront routes for catalog, locations, orders, and payment retry.
// =============================================================================

import { Router } from "express";
import {
    searchDeliveryLocationsHandler,
    getStoreMetadataHandler,
    listStoreProductsHandler,
    getProductDetailsHandler,
    placeOrderHandler,
    getPublicOrderDetailsHandler,
    retryOrderPaymentHandler,
} from "./public.controller";

const router = Router();

// Location & Estate Search (Zero-Cost Local First, Nominatim Fallback)
router.get("/estates/search", searchDeliveryLocationsHandler);

// Public Storefront Catalog Endpoints
router.get("/stores/:storeSlug", getStoreMetadataHandler);
router.get("/stores/:storeSlug/products", listStoreProductsHandler);
router.get("/stores/:storeSlug/products/:productSlug", getProductDetailsHandler);

// Public Order Placement, Receipts & In-Place Payment Retry
router.post('/stores/:storeSlug/orders', placeOrderHandler);
router.get('/stores/:storeSlug/orders/:orderId', getPublicOrderDetailsHandler);
router.post('/stores/:storeSlug/orders/:orderId/retry-payment', retryOrderPaymentHandler);

export default router;