/**
 * Health check script for Docker
 * Exits 0 if healthy, 1 if unhealthy
 */

const { getConnection } = require('./couchdb-client');
const logger = require('./logger');

async function healthCheck() {
  try {
    // Test CouchDB connection
    const couch = getConnection();
    await couch.db.list();

    console.log('Health check: OK');
    process.exit(0);
  } catch (error) {
    console.error('Health check: FAILED', error.message);
    process.exit(1);
  }
}

// Run health check
healthCheck();
