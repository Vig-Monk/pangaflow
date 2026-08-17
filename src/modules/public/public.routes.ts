// =============================================================================
// src/modules/public/public.routes.ts
// =============================================================================

import { Router } from "express";
import {
    searchDeliveryLocationsHandler,
    getStoreMetadataHandler,
    listStoreProductsHandler,
    getProductDetailsHandler,
    placeOrderHandler,
    getPublicOrderDetailsHandler
} from "./public.controller";

const router = Router();

// Location & Estate Search (Zero-Cost Local First, Nominatim Fallback)
router.get("/estates/search", searchDeliveryLocationsHandler);

// Public Storefront Catalog & Checkout Endpoints
router.get("/stores/:storeSlug", getStoreMetadataHandler);
router.get("/stores/:storeSlug/products", listStoreProductsHandler);
router.get("/stores/:storeSlug/products/:productSlug", getProductDetailsHandler);
router.post('/stores/:storeSlug/orders', placeOrderHandler);
router.get('/stores/:storeSlug/orders/:orderId', getPublicOrderDetailsHandler);

export default router;