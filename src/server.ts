// =============================================================================
// soko-api/src/server.ts
// Starts Express API server and auto-boots background BullMQ worker.
// =============================================================================

import app from './app';
import { env } from './config/env';
import { pool } from './config/db';
import { redisConnection } from './verticals/books/import/import.service';
import pino from 'pino';

// Auto-boot BullMQ Spreadsheet Ingestion Worker
import './verticals/books/import/import.worker';

const logger = pino();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Soko API running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  logger.info(`📦 BullMQ Book Import Worker active and listening to [book-import-queue]`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      logger.error('Error occurred while closing HTTP server:', err);
      process.exit(1);
    }

    logger.info('HTTP server successfully closed.');

    try {
      await pool.end();
      logger.info('Database connection pool successfully closed.');
    } catch (dbErr) {
      logger.error('Error occurred while closing database connection pool:', dbErr);
    }

    try {
      await redisConnection.quit();
      logger.info('Redis connection successfully closed.');
    } catch (redisErr) {
      logger.error('Error closing Redis connection:', redisErr);
    }

    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown initiated due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));