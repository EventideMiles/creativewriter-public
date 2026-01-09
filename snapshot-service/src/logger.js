/**
 * Logging configuration using Winston
 */

const winston = require('winston');
const config = require('./config');
const fs = require('fs');
const path = require('path');

/**
 * Safe JSON stringify that handles circular references
 * Replaces circular refs with [Circular] marker
 */
function safeStringify(obj, indent = 0) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    // Handle Error objects specially
    if (value instanceof Error) {
      return {
        message: value.message,
        name: value.name,
        stack: value.stack,
        // Include common HTTP error properties
        statusCode: value.statusCode,
        error: value.error,
        reason: value.reason
      };
    }
    // Skip problematic properties that cause circular refs
    if (key === 'request' || key === 'socket' || key === 'agent' || key === 'connection') {
      return '[Omitted]';
    }
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }, indent);
}

// Ensure log directory exists
const logDir = path.dirname(config.LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'snapshot-service' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            // Filter out internal winston metadata before stringifying
            const { service, ...rest } = metadata;
            if (Object.keys(rest).length > 0) {
              msg += ` ${safeStringify(rest)}`;
            }
          }
          return msg;
        })
      )
    }),
    // File output
    new winston.transports.File({
      filename: config.LOG_FILE,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

module.exports = logger;
