import app from './app';
import { env } from './config/env';
import { pool } from './config/db';
import pino from 'pino';

const logger = pino();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
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
      process.exit(0);
    } catch (dbErr) {
      logger.error('Error occurred while closing database connection pool:', dbErr);
      process.exit(1);
    }
  });

  // Enforce quick shutdown if pending processes hang
  setTimeout(() => {
    logger.error('Forced shutdown initiated due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));