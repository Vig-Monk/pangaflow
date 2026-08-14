// =============================================================================
// src/modules/products/products.routes.ts
// =============================================================================

import { Router } from "express";
import { verifyToken } from "../../middleware/auth";
import { checkProductLimit } from "../../middleware/checkLimit";
import {
    uploadSignatureHandler,
    createCategoryHandler,
    listCategoriesHandler,
    listProductsHandler,
    getProductHandler,
    updateProductHandler,
    deleteProductHandler,
    publishProductHandler,
    unpublishProductHandler,
    archiveProductHandler,
    unarchiveProductHandler,
    listInventoryHandler,
    updateStockHandler,
    createProductsBulkHandler
} from "./products.controller";

const router = Router();

router.use(verifyToken);

// Inventory Paths
router.get("/inventory", listInventoryHandler);
router.patch("/inventory/:productId", updateStockHandler);

// Image Signature Generation
router.post("/upload-signature", uploadSignatureHandler);

// Bulk Creation Path (Applying Product Plan Gating)
router.post("/bulk", checkProductLimit, createProductsBulkHandler);

// Standard Product Paths
router.get("/", listProductsHandler);
router.post("/categories", createCategoryHandler);
router.get("/categories", listCategoriesHandler);
router.get("/:id", getProductHandler);
router.patch("/:id", updateProductHandler);
router.delete("/:id", deleteProductHandler);

// Status Mutations
router.post("/:id/publish", publishProductHandler);
router.post("/:id/unpublish", unpublishProductHandler);
router.post("/:id/archive", archiveProductHandler);
router.post("/:id/unarchive", unarchiveProductHandler);

export default router;
