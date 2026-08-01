import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { AppError } from "./utils/error";
//import { success } from "./utils/response";
import { HealthCheckResponse } from "./types/health";
import { pool } from "./config/db";
import authRoutes from "./modules/auth/auth.routes";
// ADD: customers module — import alongside auth
import customersRoutes from "./modules/customers/customers.routes";
import transactionsRoutes from "./modules/transactions/transactions.routes";
import dashboardRoutes from "./modules/transactions/dashboard.routes";
import paymentsRoutes from "./modules/payments/payments.routes";
import agentRoutes from "./verticals/market/agent.routes";
import expensesRoutes from "./modules/expenses/expenses.routes";
import adminRoutes from "./modules/admin/admin.routes";

const app = express();

// Security Headers & CORS
app.use(helmet());
const allowedOrigins: string[] = [
    "http://localhost:5173", // local frontend dev
    env.FRONTEND_URL // production frontend (Vercel), see env.ts patch below
].filter((origin): origin is string => origin.length > 0);

app.use(
    cors({
        origin: (requestOrigin, callback) => {
            // Allow requests with no Origin header at all (server-to-server
            // calls, curl, Postman, Safaricom's own callback POST) — CORS is
            // a browser-enforced mechanism; a missing Origin header means the
            // request isn't coming from a browser in the first place, so
            // there's nothing for CORS to protect against here.
            if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
                callback(null, true);
                return;
            }
            callback(
                new Error(`Origin ${requestOrigin} is not allowed by CORS`)
            );
        }
    })
);

// Request Parser
app.use(express.json());

// Request ID Generation Middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
    req.requestId = uuidv4();
    next();
});

// Production HTTP logger
app.use(
    pinoHttp({
        customProps: req => ({
            // FIX: reqCustomProps → customProps (pino-http v9)
            requestId: (req as Request).requestId
        }),
        autoLogging: {
            ignore: req => req.url === "/api/v1/health"
        }
    })
);

// Global Rate Limiting
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

// ---------------------------------------------------------------------------
// API Router — v1
//
// FIX 1: DUPLICATE MOUNT REMOVED.
// The original file had:
//
//   app.use("/api/v1", apiRouter);   ← first mount
//   apiRouter.use("/auth", authRoutes);
//   app.use("/api/v1", apiRouter);   ← second mount (BUG)
//
// Express processes middleware in registration order. Mounting apiRouter
// onto app before the auth/customers routes are attached to apiRouter means
// the first mount captures requests with zero sub-routes registered.
// The second mount then registers them — but now the router is mounted
// twice, so every request hits the router twice. On routes that have
// side-effects (POST /auth/login writing a refresh token, POST /customers
// creating a row) this silently doubles the work. On routes that throw,
// the error fires twice — once per mount — and the second attempt hits an
// already-sent response, causing Express to emit an
// "ERR_HTTP_HEADERS_SENT" warning.
//
// FIX: Attach ALL sub-routes to apiRouter FIRST, then mount once at the end.
// ---------------------------------------------------------------------------

const apiRouter = express.Router();

// Health check — no auth required
apiRouter.get("/health", async (_req: Request, res: Response) => {
    let dbStatus: HealthCheckResponse["db"] = "connected";

    try {
        // SELECT 1 — cheapest possible round-trip that confirms the pool
        // can actually acquire a connection and the database responds.
        // Not a real query against any table — just a liveness probe.
        await pool.query("SELECT 1");
    } catch {
        dbStatus = "error";
    }

    const response: HealthCheckResponse = {
        status: dbStatus === "connected" ? "ok" : "error",
        db: dbStatus,
        timestamp: new Date().toISOString()
    };

    // 200 when healthy, 503 when the DB check fails — Render's health
    // check (and most uptime monitors) treat a non-2xx response as
    // "unhealthy," which is the actual signal you want on a DB outage.
    res.status(dbStatus === "connected" ? 200 : 503).json(response);
});

// FIX 2: AUTH ROUTES MOVED TO AFTER apiRouter CREATION, BEFORE MOUNT.
// In the original file, authRoutes was attached after the first (duplicate)
// app.use call. Now it is attached here, in the correct pre-mount position.
apiRouter.use("/auth", authRoutes);

// ADD: customers routes — protected by verifyToken inside customers.routes.ts
apiRouter.use("/customers", customersRoutes);
apiRouter.use("/transactions", transactionsRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/payments", paymentsRoutes);
apiRouter.use("/agent", agentRoutes);
apiRouter.use("/expenses", expensesRoutes);
apiRouter.use("/admin", adminRoutes);
// FIX 1 (continued): Single mount — this line appears exactly once, after
// all sub-routes are attached to apiRouter above.
app.use("/api/v1", apiRouter);

// ---------------------------------------------------------------------------
// 404 handler — must come after all routes, before errorHandler
// ---------------------------------------------------------------------------
app.use((req: Request, _res: Response, next: NextFunction) => {
    next(
        new AppError(
            `Endpoint not found: ${req.method} ${req.originalUrl}`,
            404
        )
    );
});

// Global Error Handler — must be last
app.use(errorHandler);

export default app;
