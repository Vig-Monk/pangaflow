// =============================================================================
// soko-api/src/modules/products/products.routes.ts
// =============================================================================

import { Router } from "express";
import { verifyToken } from "../../middleware/auth";
import { checkProductLimit } from "../../middleware/checkLimit";
import {
    uploadSignatureHandler,
    autoFindBookCoverHandler,
    createCategoryHandler,
    listCategoriesHandler,
    listProductsHandler,
    getProductHandler,
    updateProductHandler,
    deleteProductHandler,
    bulkDeleteProductsHandler,
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

// Automated Typo-Tolerant Cover Art Discovery
router.get("/find-cover", autoFindBookCoverHandler);

// Inventory Paths
router.get("/inventory", listInventoryHandler);
router.patch("/inventory/:productId", updateStockHandler);

// Image Signature Generation
router.post("/upload-signature", uploadSignatureHandler);

// Bulk Operations
router.post("/bulk", checkProductLimit, createProductsBulkHandler);
router.post("/bulk-delete", bulkDeleteProductsHandler);

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