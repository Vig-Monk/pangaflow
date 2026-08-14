// =============================================================================
// src/modules/public/public.routes.ts (CORRECTED)
// =============================================================================

import { Router } from "express";
import {
    getStoreMetadataHandler,
    listStoreProductsHandler,
    getProductDetailsHandler,
    placeOrderHandler,
    getPublicOrderDetailsHandler
} from "./public.controller";

const router = Router();

router.get("/stores/:storeSlug", getStoreMetadataHandler);
router.get("/stores/:storeSlug/products", listStoreProductsHandler);
router.get("/stores/:storeSlug/products/:productSlug", getProductDetailsHandler);
router.post('/stores/:storeSlug/orders', placeOrderHandler);
router.get('/stores/:storeSlug/orders/:orderId', getPublicOrderDetailsHandler);

export default router;