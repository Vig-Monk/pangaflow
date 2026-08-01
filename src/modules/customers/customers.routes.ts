// src/modules/customers/customers.routes.ts
import { Router } from "express";
import { verifyToken } from "../../middleware/auth";
import { checkCustomerLimit } from "../../middleware/checkLimit";
import {
    archiveHandler,
    createHandler,
    deleteHandler,
    getOneHandler,
    listHandler,
    searchHandler,
    updateHandler
} from "./customers.controller";

const router = Router();

router.use(verifyToken);

router.get("/search", searchHandler);

router.get("/", listHandler);
router.post("/", checkCustomerLimit, createHandler);
router.get("/:id", getOneHandler);
router.patch("/:id", updateHandler);
router.patch("/:id/archive", archiveHandler);
router.delete("/:id", deleteHandler);

export default router;
