/**
 * Logging configuration using Winston
 */

const winston = require('winston');
const config = require('./config');
const fs = require('fs');
const path = require('path');

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
            msg += ` ${JSON.stringify(metadata)}`;
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
