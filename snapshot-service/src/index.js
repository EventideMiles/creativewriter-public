/**
 * Snapshot Service - Main Entry Point
 *
 * Automated snapshot creation and retention management for Creative Writer stories
 */

const logger = require('./logger');
const config = require('./config');
const { initializeScheduler } = require('./scheduler');
const { getConnection, getAllUserDatabases } = require('./couchdb-client');
const { getAllSnapshotStats } = require('./retention-manager');

/**
 * Startup initialization
 */
async function startup() {
  logger.info('=== Creative Writer Snapshot Service ===');
  logger.info(`Version: ${require('../package.json').version}`);
  logger.info(`Node: ${process.version}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Log configuration (without sensitive data)
  logger.info('Configuration:', {
    couchdb: {
      host: config.COUCHDB_HOST,
      port: config.COUCHDB_PORT,
      user: config.COUCHDB_USER
    },
    snapshots: {
      enabled: config.SNAPSHOT_ENABLED,
      maxPerStory: config.MAX_SNAPSHOTS_PER_STORY,
      idleThresholdMinutes: config.IDLE_THRESHOLD_MINUTES,
      batchSize: config.BATCH_SIZE
    },
    timezone: config.TZ,
    logLevel: config.LOG_LEVEL
  });

  try {
    // Test CouchDB connection
    logger.info('Testing CouchDB connection...');
    const couch = getConnection();
    const info = await couch.db.list();
    logger.info(`Connected to CouchDB successfully (${info.length} databases found)`);

    // Discover user databases
    const databases = await getAllUserDatabases();
    logger.info(`Found ${databases.length} user databases to monitor`);

    // Get initial snapshot statistics
    logger.info('Loading initial snapshot statistics...');
    const stats = await getAllSnapshotStats();
    logger.info('Initial snapshot statistics:', stats);

    // Initialize scheduler
    initializeScheduler();

    logger.info('=== Snapshot Service Ready ===');
    logger.info('Service is running and waiting for scheduled tasks');
  } catch (error) {
    logger.error('Failed to start snapshot service:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Get final statistics
    const stats = await getAllSnapshotStats();
    logger.info('Final snapshot statistics:', stats);

    logger.info('Snapshot service stopped');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

// Start the service
startup().catch((error) => {
  logger.error('Startup failed:', error);
  process.exit(1);
});
