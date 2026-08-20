// =============================================================================
// src/app.ts
// =============================================================================

import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { AppError } from "./utils/error";
import { HealthCheckResponse } from "./types/health";
import { pool } from "./config/db";

// Route Imports
import authRoutes from "./modules/auth/auth.routes";
import customersRoutes from "./modules/customers/customers.routes";
import transactionsRoutes from "./modules/transactions/transactions.routes";
import dashboardRoutes from "./modules/transactions/dashboard.routes";
import paymentsRoutes from "./modules/payments/payments.routes";
import agentRoutes from "./verticals/market/agent.routes";
import expensesRoutes from "./modules/expenses/expenses.routes";
import adminRoutes from "./modules/admin/admin.routes";
import productsRoutes from "./modules/products/products.routes";
import storesRoutes from "./modules/stores/stores.routes";
import ordersRoutes from "./modules/orders/orders.routes";
import publicRoutes from "./modules/public/public.routes";
import mpesaCredentialsRoutes from "./modules/mpesa-credentials/mpesa-credentials.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";

const app = express();

app.use(helmet());

app.use(
    cors({
        origin: (requestOrigin, callback) => {
            if (!requestOrigin) return callback(null, true);

            let isAllowed = false;
            try {
                const url = new URL(requestOrigin);
                const normalizedFrontend = env.FRONTEND_URL?.replace(/\/$/, "");

                isAllowed =
                    requestOrigin === "http://localhost:5173" ||
                    requestOrigin === normalizedFrontend ||
                    url.hostname.endsWith(".vercel.app");
            } catch {
                isAllowed = false;
            }

            if (isAllowed) {
                return callback(null, true);
            }
            return callback(
                new Error(`Origin ${requestOrigin} is not allowed by CORS`)
            );
        },
        credentials: true
    })
);

app.use(express.json());

app.use((req: Request, _res: Response, next: NextFunction) => {
    req.requestId = uuidv4();
    next();
});

app.use(
    pinoHttp({
        customProps: req => ({
            requestId: (req as Request).requestId
        }),
        autoLogging: {
            ignore: req => req.url === "/api/v1/health"
        }
    })
);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: "Too many requests. Please try again later."
        }
    }
});
app.use(limiter);

const apiRouter = express.Router();

apiRouter.get("/health", async (_req: Request, res: Response) => {
    let dbStatus: HealthCheckResponse["db"] = "connected";

    try {
        await pool.query("SELECT 1");
    } catch {
        dbStatus = "error";
    }

    const response: HealthCheckResponse = {
        status: dbStatus === "connected" ? "ok" : "error",
        db: dbStatus,
        timestamp: new Date().toISOString()
    };

    res.status(dbStatus === "connected" ? 200 : 503).json(response);
});

apiRouter.use("/auth", authRoutes);
apiRouter.use("/customers", customersRoutes);
apiRouter.use("/transactions", transactionsRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/payments", paymentsRoutes);
apiRouter.use("/agent", agentRoutes);
apiRouter.use("/expenses", expensesRoutes);
apiRouter.use("/public", publicRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/products", productsRoutes);
apiRouter.use("/store", storesRoutes);
apiRouter.use("/orders", ordersRoutes);
apiRouter.use("/mpesa-credentials", mpesaCredentialsRoutes);
apiRouter.use("/analytics", analyticsRoutes);
app.use("/api/v1", apiRouter);

app.use((req: Request, _res: Response, next: NextFunction) => {
    next(
        new AppError(
            `Endpoint not found: ${req.method} ${req.originalUrl}`,
            404
        )
    );
});

app.use(errorHandler);

export default app;