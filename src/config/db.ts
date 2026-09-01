// =============================================================================
// soko-api/src/config/db.ts
// PostgreSQL connection pool with secure TLS CA verification in production.
// =============================================================================

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from './env';
import pino from 'pino';

const logger = pino();
const isProduction = env.NODE_ENV === 'production';

// In production, enforce CA verification unless explicitly overridden for local self-signed setups
const sslConfig = isProduction
  ? {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true,
    }
  : false;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslConfig,
});

pool.on('error', (err) => {
  logger.error('Unexpected pool error on idle PostgreSQL client:', err);
});

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug({ text, duration, rows: res.rowCount }, 'Database query executed');
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error({ text, duration, err }, 'Database query failed');
    throw err;
  }
}