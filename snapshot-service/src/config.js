/**
 * Configuration for snapshot service
 * Loaded from environment variables
 */

module.exports = {
  // CouchDB connection
  COUCHDB_HOST: process.env.COUCHDB_HOST || 'couchdb',
  COUCHDB_PORT: process.env.COUCHDB_PORT || 5984,
  COUCHDB_USER: process.env.COUCHDB_USER || 'admin',
  COUCHDB_PASSWORD: process.env.COUCHDB_PASSWORD || 'password',

  // Database pattern for user databases
  DATABASE_PATTERN: process.env.DATABASE_PATTERN || 'creative-writer-stories',

  // Snapshot settings
  SNAPSHOT_ENABLED: process.env.SNAPSHOT_ENABLED !== 'false',
  MAX_SNAPSHOTS_PER_STORY: parseInt(process.env.MAX_SNAPSHOTS_PER_STORY || '500'),

  // Schedules (cron expressions)
  SCHEDULE_GRANULAR: process.env.SCHEDULE_GRANULAR || '*/15 * * * *',  // Every 15 minutes
  SCHEDULE_HOURLY: process.env.SCHEDULE_HOURLY || '0 * * * *',         // Every hour
  SCHEDULE_DAILY: process.env.SCHEDULE_DAILY || '0 2 * * *',           // Daily at 2 AM
  SCHEDULE_WEEKLY: process.env.SCHEDULE_WEEKLY || '0 3 * * 0',         // Sunday at 3 AM
  SCHEDULE_MONTHLY: process.env.SCHEDULE_MONTHLY || '0 4 1 * *',       // 1st of month at 4 AM
  SCHEDULE_CLEANUP: process.env.SCHEDULE_CLEANUP || '0 5 * * *',       // Daily at 5 AM

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || '/var/log/snapshot-service/snapshots.log',

  // Timezone
  TZ: process.env.TZ || 'Europe/Berlin',

  // Performance tuning
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '10'),  // Process stories in batches
  IDLE_THRESHOLD_MINUTES: parseInt(process.env.IDLE_THRESHOLD_MINUTES || '5')  // Only snapshot if idle
};
