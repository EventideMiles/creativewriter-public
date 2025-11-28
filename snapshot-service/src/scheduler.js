/**
 * Cron scheduler for snapshot operations
 */

const cron = require('node-cron');
const logger = require('./logger');
const config = require('./config');
const { createSnapshotsForAllDatabases } = require('./snapshot-creator');
const { pruneExpiredSnapshotsForAllDatabases, getAllSnapshotStats } = require('./retention-manager');

/**
 * Initialize and start all scheduled tasks
 */
function initializeScheduler() {
  if (!config.SNAPSHOT_ENABLED) {
    logger.warn('Snapshot service is DISABLED via configuration');
    return;
  }

  logger.info('Initializing snapshot scheduler');
  logger.info(`Timezone: ${config.TZ}`);
  logger.info(`Schedules:
    - Granular (15-min): ${config.SCHEDULE_GRANULAR}
    - Hourly: ${config.SCHEDULE_HOURLY}
    - Daily: ${config.SCHEDULE_DAILY}
    - Weekly: ${config.SCHEDULE_WEEKLY}
    - Monthly: ${config.SCHEDULE_MONTHLY}
    - Cleanup: ${config.SCHEDULE_CLEANUP}`);

  // Granular snapshots (every 15 minutes)
  cron.schedule(config.SCHEDULE_GRANULAR, async () => {
    logger.info('[CRON] Triggered granular snapshot creation');
    try {
      await createSnapshotsForAllDatabases('granular');
    } catch (error) {
      logger.error('[CRON] Granular snapshot creation failed:', error);
    }
  }, {
    timezone: config.TZ
  });

  // Hourly snapshots
  cron.schedule(config.SCHEDULE_HOURLY, async () => {
    logger.info('[CRON] Triggered hourly snapshot creation');
    try {
      await createSnapshotsForAllDatabases('hourly');
    } catch (error) {
      logger.error('[CRON] Hourly snapshot creation failed:', error);
    }
  }, {
    timezone: config.TZ
  });

  // Daily snapshots
  cron.schedule(config.SCHEDULE_DAILY, async () => {
    logger.info('[CRON] Triggered daily snapshot creation');
    try {
      await createSnapshotsForAllDatabases('daily');
    } catch (error) {
      logger.error('[CRON] Daily snapshot creation failed:', error);
    }
  }, {
    timezone: config.TZ
  });

  // Weekly snapshots
  cron.schedule(config.SCHEDULE_WEEKLY, async () => {
    logger.info('[CRON] Triggered weekly snapshot creation');
    try {
      await createSnapshotsForAllDatabases('weekly');
    } catch (error) {
      logger.error('[CRON] Weekly snapshot creation failed:', error);
    }
  }, {
    timezone: config.TZ
  });

  // Monthly snapshots
  cron.schedule(config.SCHEDULE_MONTHLY, async () => {
    logger.info('[CRON] Triggered monthly snapshot creation');
    try {
      await createSnapshotsForAllDatabases('monthly');
    } catch (error) {
      logger.error('[CRON] Monthly snapshot creation failed:', error);
    }
  }, {
    timezone: config.TZ
  });

  // Cleanup/retention management
  cron.schedule(config.SCHEDULE_CLEANUP, async () => {
    logger.info('[CRON] Triggered snapshot cleanup');
    try {
      await pruneExpiredSnapshotsForAllDatabases();
    } catch (error) {
      logger.error('[CRON] Snapshot cleanup failed:', error);
    }
  }, {
    timezone: config.TZ
  });

  // Health check and statistics (every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[CRON] Triggered health check');
    try {
      const stats = await getAllSnapshotStats();
      logger.info('Snapshot statistics:', stats);
    } catch (error) {
      logger.error('[CRON] Health check failed:', error);
    }
  }, {
    timezone: config.TZ
  });

  logger.info('Snapshot scheduler initialized successfully');
}

module.exports = {
  initializeScheduler
};
