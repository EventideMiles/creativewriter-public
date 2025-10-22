# Story Snapshot Service - Server-Side Design Document

**Status**: Design Phase - Server-Side Architecture
**Created**: 2025-10-22
**Author**: System Design
**Version**: 2.0 (Revised)

---

## Executive Summary

This document outlines a **server-side snapshot service** implemented as a separate Docker container that runs scheduled tasks to create time-based snapshots of all stories in the CouchDB database. This approach provides reliable, centralized snapshot management independent of client devices.

### Key Requirements
- Server-side scheduled snapshots: 15 minutes, 1 hour, 1 day intervals
- Automated retention policy (GFS - Grandfather-Father-Son)
- Minimal impact on CouchDB performance
- Works for all users automatically
- Independent Docker container in the stack
- Comprehensive logging and monitoring

---

## Why Server-Side?

### Advantages Over Client-Side Snapshots

| Aspect | Server-Side ✅ | Client-Side ❌ |
|--------|---------------|---------------|
| **Reliability** | Guaranteed - always running | Depends on app being open |
| **Consistency** | Exact schedule for all users | Varies by user activity |
| **Storage** | Centralized in CouchDB | Distributed across devices |
| **Battery/Performance** | Zero client impact | Additional CPU/storage load |
| **Management** | Single service to monitor | Multiple clients to coordinate |
| **Offline scenarios** | Works when client offline | Stops when offline |
| **Multi-device** | Immediately available everywhere | May lag during sync |

### Trade-offs

**Pros:**
- ✅ More reliable and predictable
- ✅ Easier to monitor and debug
- ✅ No client-side complexity
- ✅ Better for collaborative features (future)
- ✅ Can run during low-traffic hours

**Cons:**
- ❌ Requires server infrastructure (already have Docker stack)
- ❌ All snapshots in CouchDB (but that's where data lives anyway)
- ❌ Needs CouchDB credentials (already configured)

**Verdict:** Server-side is the better approach for this use case.

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                   Docker Stack                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐         ┌──────────────┐            │
│  │   CouchDB    │◄────────┤   Snapshot   │            │
│  │              │  Query  │   Service    │            │
│  │  - Stories   │  Write  │              │            │
│  │  - Snapshots │◄────────┤  - Scheduler │            │
│  └──────────────┘         │  - Retention │            │
│                           │  - Logging   │            │
│                           └──────────────┘            │
│                                 ▲                      │
│                                 │                      │
│                          ┌──────┴──────┐              │
│                          │  node-cron  │              │
│                          │  schedules  │              │
│                          └─────────────┘              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Snapshot Service Responsibilities

1. **Scheduler**: Run snapshot tasks on defined intervals
2. **Snapshot Creator**: Query stories and create snapshot documents
3. **Retention Manager**: Prune old snapshots based on GFS policy
4. **Health Monitor**: Log operations, track errors, expose metrics
5. **Configuration Manager**: Load settings from environment variables

---

## Implementation Design

### Technology Stack

- **Runtime**: Node.js 18 Alpine (minimal, 5MB base)
- **Scheduler**: `node-cron` (lightweight, reliable)
- **Database Client**: `nano` (official CouchDB client for Node.js)
- **Logging**: `winston` (structured logging)
- **Container**: Docker (Alpine Linux)

### Project Structure

```
snapshot-service/
├── package.json
├── src/
│   ├── index.js                 # Main entry point
│   ├── scheduler.js             # Cron job definitions
│   ├── snapshot-creator.js      # Snapshot creation logic
│   ├── retention-manager.js     # GFS pruning logic
│   ├── couchdb-client.js        # CouchDB connection
│   ├── logger.js                # Winston configuration
│   └── config.js                # Environment config
├── Dockerfile.snapshot-service
└── README.md
```

---

## Snapshot Document Schema

### Snapshot Document Structure

```javascript
{
  "_id": "snapshot-{storyId}-{timestamp}",
  "_rev": "1-abc123...",
  "type": "story-snapshot",

  // Metadata
  "storyId": "story-xyz",
  "userId": "user-123",              // For multi-tenancy
  "createdAt": "2025-10-22T14:30:00.000Z",
  "retentionTier": "granular",       // granular, hourly, daily, weekly, monthly
  "expiresAt": "2025-10-22T18:30:00.000Z",  // For automatic cleanup

  // Snapshot type
  "snapshotType": "auto",            // auto | manual
  "triggeredBy": "scheduler",        // scheduler | user | event

  // Story state at snapshot time
  "snapshot": {
    "title": "My Story",
    "chapters": [...],               // Full chapter/scene structure
    "settings": {...},
    "updatedAt": "2025-10-22T14:25:00.000Z"
  },

  // Metadata for UI/reporting
  "metadata": {
    "wordCount": 5432,
    "chapterCount": 3,
    "sceneCount": 12,
    "storyVersion": 47               // Incremental version number
  }
}
```

### Indexing Strategy

CouchDB design document for efficient queries:

```javascript
{
  "_id": "_design/snapshots",
  "views": {
    "by_story_and_date": {
      "map": "function(doc) {
        if (doc.type === 'story-snapshot') {
          emit([doc.storyId, doc.createdAt], {
            tier: doc.retentionTier,
            wordCount: doc.metadata.wordCount
          });
        }
      }"
    },
    "by_expiration": {
      "map": "function(doc) {
        if (doc.type === 'story-snapshot' && doc.expiresAt) {
          emit(doc.expiresAt, doc.storyId);
        }
      }"
    },
    "by_tier": {
      "map": "function(doc) {
        if (doc.type === 'story-snapshot') {
          emit([doc.retentionTier, doc.createdAt], doc.storyId);
        }
      }"
    }
  }
}
```

---

## Scheduling Design

### Cron Schedule Configuration

```javascript
// src/scheduler.js
const cron = require('node-cron');
const snapshotCreator = require('./snapshot-creator');
const retentionManager = require('./retention-manager');

// Every 15 minutes - Granular snapshots
cron.schedule('*/15 * * * *', async () => {
  await snapshotCreator.createSnapshots('granular');
});

// Every hour (at minute 0) - Hourly snapshots
cron.schedule('0 * * * *', async () => {
  await snapshotCreator.createSnapshots('hourly');
});

// Daily at 2 AM - Daily snapshots
cron.schedule('0 2 * * *', async () => {
  await snapshotCreator.createSnapshots('daily');
});

// Weekly on Sunday at 3 AM - Weekly snapshots
cron.schedule('0 3 * * 0', async () => {
  await snapshotCreator.createSnapshots('weekly');
});

// Monthly on 1st at 4 AM - Monthly snapshots
cron.schedule('0 4 1 * *', async () => {
  await snapshotCreator.createSnapshots('monthly');
});

// Daily at 5 AM - Run retention cleanup
cron.schedule('0 5 * * *', async () => {
  await retentionManager.pruneExpiredSnapshots();
});

// Every 6 hours - Health check and logging
cron.schedule('0 */6 * * *', async () => {
  await healthCheck();
});
```

### Retention Policy (GFS)

| Tier | Frequency | Keep For | Expires After | Example |
|------|-----------|----------|---------------|---------|
| **Granular** | Every 15 min | 4 hours | 4 hours | Recent edits |
| **Hourly** | Every 1 hour | 24 hours | 24 hours | Today's work |
| **Daily** | Daily 2 AM | 30 days | 30 days | This month |
| **Weekly** | Sunday 3 AM | 12 weeks | 84 days | This quarter |
| **Monthly** | 1st @ 4 AM | 12 months | 365 days | This year |

---

## Core Implementation

### 1. Snapshot Creator

```javascript
// src/snapshot-creator.js
const logger = require('./logger');
const db = require('./couchdb-client');

async function createSnapshots(tier) {
  const startTime = Date.now();
  logger.info(`Starting ${tier} snapshot creation`);

  try {
    // Get all stories (filter by type to exclude snapshots)
    const stories = await db.view('stories', 'all', {
      include_docs: true
    });

    const snapshots = [];

    for (const row of stories.rows) {
      const story = row.doc;

      // Skip if story hasn't changed since last snapshot of this tier
      const lastSnapshot = await getLastSnapshot(story._id, tier);
      if (lastSnapshot && story.updatedAt <= lastSnapshot.snapshot.updatedAt) {
        logger.debug(`Skipping ${story._id} - no changes since last ${tier} snapshot`);
        continue;
      }

      // Create snapshot
      const snapshot = await createSnapshot(story, tier);
      snapshots.push(snapshot);
    }

    // Bulk insert for performance
    if (snapshots.length > 0) {
      const result = await db.bulk({ docs: snapshots });
      logger.info(`Created ${snapshots.length} ${tier} snapshots in ${Date.now() - startTime}ms`);
    } else {
      logger.info(`No new ${tier} snapshots needed`);
    }

    return snapshots.length;
  } catch (error) {
    logger.error(`Failed to create ${tier} snapshots:`, error);
    throw error;
  }
}

async function createSnapshot(story, tier) {
  const now = new Date();
  const expiresAt = calculateExpiration(now, tier);

  // Get version number (count of all snapshots for this story)
  const versionCount = await getSnapshotCount(story._id);

  return {
    _id: `snapshot-${story._id}-${now.getTime()}`,
    type: 'story-snapshot',
    storyId: story._id,
    userId: story.userId || 'anonymous',
    createdAt: now.toISOString(),
    retentionTier: tier,
    expiresAt: expiresAt.toISOString(),
    snapshotType: 'auto',
    triggeredBy: 'scheduler',

    snapshot: {
      title: story.title,
      chapters: story.chapters,
      settings: story.settings,
      updatedAt: story.updatedAt
    },

    metadata: {
      wordCount: calculateWordCount(story),
      chapterCount: story.chapters?.length || 0,
      sceneCount: countScenes(story),
      storyVersion: versionCount + 1
    }
  };
}

function calculateExpiration(createdAt, tier) {
  const expiresAt = new Date(createdAt);

  switch (tier) {
    case 'granular': expiresAt.setHours(expiresAt.getHours() + 4); break;
    case 'hourly': expiresAt.setHours(expiresAt.getHours() + 24); break;
    case 'daily': expiresAt.setDate(expiresAt.getDate() + 30); break;
    case 'weekly': expiresAt.setDate(expiresAt.getDate() + 84); break;
    case 'monthly': expiresAt.setDate(expiresAt.getDate() + 365); break;
  }

  return expiresAt;
}
```

### 2. Retention Manager

```javascript
// src/retention-manager.js
const logger = require('./logger');
const db = require('./couchdb-client');

async function pruneExpiredSnapshots() {
  const startTime = Date.now();
  logger.info('Starting snapshot retention cleanup');

  try {
    const now = new Date();

    // Find expired snapshots using view
    const expired = await db.view('snapshots', 'by_expiration', {
      endkey: now.toISOString(),
      include_docs: true
    });

    if (expired.rows.length === 0) {
      logger.info('No expired snapshots to delete');
      return 0;
    }

    // Mark for deletion
    const toDelete = expired.rows.map(row => ({
      ...row.doc,
      _deleted: true
    }));

    // Bulk delete
    const result = await db.bulk({ docs: toDelete });

    const deleted = result.filter(r => r.ok).length;
    const failed = result.filter(r => !r.ok).length;

    logger.info(`Deleted ${deleted} expired snapshots in ${Date.now() - startTime}ms`);
    if (failed > 0) {
      logger.warn(`Failed to delete ${failed} snapshots`);
    }

    return deleted;
  } catch (error) {
    logger.error('Failed to prune snapshots:', error);
    throw error;
  }
}

async function pruneByStory(storyId, maxSnapshots = 500) {
  // Additional safety: ensure no story has more than maxSnapshots
  const snapshots = await db.view('snapshots', 'by_story_and_date', {
    startkey: [storyId],
    endkey: [storyId, {}],
    include_docs: true
  });

  if (snapshots.rows.length <= maxSnapshots) {
    return 0;
  }

  // Sort by date (oldest first) and delete excess
  const sorted = snapshots.rows.sort((a, b) =>
    new Date(a.key[1]) - new Date(b.key[1])
  );

  const excess = sorted.slice(0, sorted.length - maxSnapshots);
  const toDelete = excess.map(row => ({
    ...row.doc,
    _deleted: true
  }));

  await db.bulk({ docs: toDelete });
  logger.info(`Pruned ${toDelete.length} excess snapshots for story ${storyId}`);

  return toDelete.length;
}
```

### 3. CouchDB Client

```javascript
// src/couchdb-client.js
const nano = require('nano');
const config = require('./config');
const logger = require('./logger');

const COUCHDB_URL = `http://${config.COUCHDB_USER}:${config.COUCHDB_PASSWORD}@${config.COUCHDB_HOST}:${config.COUCHDB_PORT}`;

let connection = null;

function getConnection() {
  if (!connection) {
    connection = nano(COUCHDB_URL);
    logger.info(`Connected to CouchDB at ${config.COUCHDB_HOST}:${config.COUCHDB_PORT}`);
  }
  return connection;
}

async function getDatabase(dbName) {
  const couch = getConnection();

  try {
    // Check if database exists
    await couch.db.get(dbName);
  } catch (error) {
    if (error.statusCode === 404) {
      // Database doesn't exist, create it
      await couch.db.create(dbName);
      logger.info(`Created database: ${dbName}`);
    } else {
      throw error;
    }
  }

  return couch.use(dbName);
}

// Wrapper for common operations
class DatabaseClient {
  constructor(dbName) {
    this.dbName = dbName;
    this.db = null;
  }

  async init() {
    this.db = await getDatabase(this.dbName);
    await this.ensureViews();
  }

  async ensureViews() {
    // Create design documents for views
    try {
      await this.db.insert({
        _id: '_design/snapshots',
        views: {
          by_story_and_date: {
            map: function(doc) {
              if (doc.type === 'story-snapshot') {
                emit([doc.storyId, doc.createdAt], {
                  tier: doc.retentionTier,
                  wordCount: doc.metadata.wordCount
                });
              }
            }.toString()
          },
          by_expiration: {
            map: function(doc) {
              if (doc.type === 'story-snapshot' && doc.expiresAt) {
                emit(doc.expiresAt, doc.storyId);
              }
            }.toString()
          }
        }
      });
    } catch (error) {
      if (error.statusCode !== 409) { // 409 = conflict (already exists)
        logger.error('Failed to create views:', error);
      }
    }
  }

  async view(designDoc, viewName, options = {}) {
    return this.db.view(designDoc, viewName, options);
  }

  async bulk(docs) {
    return this.db.bulk(docs);
  }

  async get(id) {
    return this.db.get(id);
  }
}

module.exports = new DatabaseClient(config.DATABASE_NAME);
```

### 4. Configuration

```javascript
// src/config.js
module.exports = {
  // CouchDB connection
  COUCHDB_HOST: process.env.COUCHDB_HOST || 'couchdb',
  COUCHDB_PORT: process.env.COUCHDB_PORT || 5984,
  COUCHDB_USER: process.env.COUCHDB_USER || 'admin',
  COUCHDB_PASSWORD: process.env.COUCHDB_PASSWORD || 'password',

  // Database name pattern
  DATABASE_PATTERN: process.env.DATABASE_PATTERN || 'creative-writer-stories-*',

  // Snapshot settings
  SNAPSHOT_ENABLED: process.env.SNAPSHOT_ENABLED !== 'false',
  MAX_SNAPSHOTS_PER_STORY: parseInt(process.env.MAX_SNAPSHOTS_PER_STORY || '500'),

  // Schedules (cron expressions)
  SCHEDULE_GRANULAR: process.env.SCHEDULE_GRANULAR || '*/15 * * * *',
  SCHEDULE_HOURLY: process.env.SCHEDULE_HOURLY || '0 * * * *',
  SCHEDULE_DAILY: process.env.SCHEDULE_DAILY || '0 2 * * *',
  SCHEDULE_WEEKLY: process.env.SCHEDULE_WEEKLY || '0 3 * * 0',
  SCHEDULE_MONTHLY: process.env.SCHEDULE_MONTHLY || '0 4 1 * *',
  SCHEDULE_CLEANUP: process.env.SCHEDULE_CLEANUP || '0 5 * * *',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || '/var/log/snapshot-service/snapshots.log',

  // Timezone
  TZ: process.env.TZ || 'Europe/Berlin'
};
```

---

## Docker Integration

### Dockerfile.snapshot-service

```dockerfile
FROM node:18-alpine

# Install timezone data
RUN apk add --no-cache tzdata

WORKDIR /app

# Copy package files
COPY snapshot-service/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY snapshot-service/src ./src

# Create log directory
RUN mkdir -p /var/log/snapshot-service

# Set timezone (can be overridden)
ENV TZ=Europe/Berlin

# Health check
HEALTHCHECK --interval=5m --timeout=3s \
  CMD node src/health-check.js || exit 1

# Run the service
CMD ["node", "src/index.js"]
```

### package.json

```json
{
  "name": "creativewriter-snapshot-service",
  "version": "1.0.0",
  "description": "Automated snapshot service for Creative Writer stories",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "nano": "^10.1.3",
    "node-cron": "^3.0.3",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### Updated docker-compose.yml

```yaml
version: '3.8'

services:
  nginx:
    image: ghcr.io/marcodroll/creativewriter2-nginx:latest
    restart: unless-stopped
    ports:
      - "${PORT:-3080}:80"
    depends_on:
      - creativewriter
      - couchdb
      - replicate-proxy
      - gemini-proxy
    networks:
      - creativewriter-network

  creativewriter:
    image: ghcr.io/marcodroll/creativewriter2:latest
    restart: unless-stopped
    environment:
      - TZ=${TZ:-Europe/Berlin}
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    networks:
      - creativewriter-network
    depends_on:
      - couchdb

  couchdb:
    image: ghcr.io/marcodroll/creativewriter2-couchdb:latest
    restart: unless-stopped
    ports:
      - "5984:5984"
    environment:
      - COUCHDB_USER=${COUCHDB_USER:-admin}
      - COUCHDB_PASSWORD=${COUCHDB_PASSWORD:-password}
      - COUCHDB_SECRET=${COUCHDB_SECRET:-mysecret}
    volumes:
      - ${DATA_PATH:-./data}/couchdb-data:/opt/couchdb/data
      - ${DATA_PATH:-./data}/log/couchdb_log:/opt/couchdb/var/log
    networks:
      - creativewriter-network

  # NEW: Snapshot Service
  snapshot-service:
    image: ghcr.io/marcodroll/creativewriter2-snapshot-service:latest
    restart: unless-stopped
    environment:
      - COUCHDB_HOST=couchdb
      - COUCHDB_PORT=5984
      - COUCHDB_USER=${COUCHDB_USER:-admin}
      - COUCHDB_PASSWORD=${COUCHDB_PASSWORD:-password}
      - TZ=${TZ:-Europe/Berlin}
      - LOG_LEVEL=${SNAPSHOT_LOG_LEVEL:-info}
      - SNAPSHOT_ENABLED=${SNAPSHOT_ENABLED:-true}
      # Optional: override schedules
      # - SCHEDULE_GRANULAR=*/15 * * * *
      # - SCHEDULE_DAILY=0 2 * * *
    volumes:
      - ${DATA_PATH:-./data}/log/snapshot-service:/var/log/snapshot-service
    networks:
      - creativewriter-network
    depends_on:
      - couchdb
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  replicate-proxy:
    image: ghcr.io/marcodroll/creativewriter2-proxy:latest
    restart: unless-stopped
    environment:
      - PORT=3001
    networks:
      - creativewriter-network
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  gemini-proxy:
    image: ghcr.io/marcodroll/creativewriter2-gemini-proxy:latest
    restart: unless-stopped
    environment:
      - PORT=3002
    networks:
      - creativewriter-network
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

networks:
  creativewriter-network:
    driver: bridge
```

---

## Client-Side Integration

### Snapshot Timeline Service (Angular)

The client only needs to **read** and **restore** snapshots, not create them.

```typescript
// src/app/stories/services/snapshot.service.ts
@Injectable({
  providedIn: 'root'
})
export class SnapshotService {
  private readonly databaseService = inject(DatabaseService);

  /**
   * Get snapshot timeline for a story
   */
  async getSnapshotTimeline(storyId: string): Promise<SnapshotTimeline> {
    const db = await this.databaseService.getDatabase();

    // Query snapshots using CouchDB view
    const result = await db.query('snapshots/by_story_and_date', {
      startkey: [storyId],
      endkey: [storyId, {}],
      include_docs: true,
      descending: true  // Newest first
    });

    const snapshots = result.rows.map(row => row.doc as StorySnapshot);

    // Group by retention tier
    return {
      recent: snapshots.filter(s => s.retentionTier === 'granular'),
      hourly: snapshots.filter(s => s.retentionTier === 'hourly'),
      daily: snapshots.filter(s => s.retentionTier === 'daily'),
      weekly: snapshots.filter(s => s.retentionTier === 'weekly'),
      monthly: snapshots.filter(s => s.retentionTier === 'monthly')
    };
  }

  /**
   * Restore story from snapshot
   */
  async restoreFromSnapshot(
    storyId: string,
    snapshotId: string,
    options: { createBackup?: boolean } = {}
  ): Promise<Story> {
    const db = await this.databaseService.getDatabase();

    // Get snapshot
    const snapshot = await db.get(snapshotId) as StorySnapshot;

    // Get current story
    const currentStory = await db.get(storyId) as Story;

    // Optionally create manual backup
    if (options.createBackup) {
      await this.createManualSnapshot(currentStory, 'Before restore');
    }

    // Restore snapshot data to current story
    const restoredStory: Story = {
      ...currentStory,
      title: snapshot.snapshot.title,
      chapters: snapshot.snapshot.chapters,
      settings: snapshot.snapshot.settings,
      updatedAt: new Date()
    };

    await db.put(restoredStory);

    return restoredStory;
  }

  /**
   * Create manual snapshot (user-triggered)
   */
  async createManualSnapshot(story: Story, reason: string): Promise<void> {
    const db = await this.databaseService.getDatabase();

    const snapshot: StorySnapshot = {
      _id: `snapshot-${story._id}-${Date.now()}`,
      type: 'story-snapshot',
      storyId: story._id!,
      userId: story.userId || 'anonymous',
      createdAt: new Date().toISOString(),
      retentionTier: 'manual',  // Never auto-expires
      snapshotType: 'manual',
      triggeredBy: 'user',
      reason: reason,

      snapshot: {
        title: story.title,
        chapters: story.chapters,
        settings: story.settings,
        updatedAt: story.updatedAt
      },

      metadata: {
        wordCount: this.calculateWordCount(story),
        chapterCount: story.chapters.length,
        sceneCount: this.countScenes(story),
        storyVersion: 0  // Will be updated by server
      }
    };

    await db.put(snapshot);
  }
}
```

---

## Monitoring & Operations

### Logging Strategy

```javascript
// src/logger.js
const winston = require('winston');
const config = require('./config');

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({
      filename: config.LOG_FILE,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

module.exports = logger;
```

### Health Check

```javascript
// src/health-check.js
const db = require('./couchdb-client');
const logger = require('./logger');

async function healthCheck() {
  try {
    await db.init();

    // Test CouchDB connection
    await db.get('_design/snapshots');

    logger.info('Health check passed');
    process.exit(0);
  } catch (error) {
    logger.error('Health check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  healthCheck();
}

module.exports = healthCheck;
```

### Metrics Collection

```javascript
// Track metrics for monitoring
const metrics = {
  snapshotsCreated: 0,
  snapshotsDeleted: 0,
  errors: 0,
  lastRun: {},
  totalRuntime: {}
};

function recordMetric(operation, duration, count) {
  metrics.lastRun[operation] = new Date();
  metrics.totalRuntime[operation] = (metrics.totalRuntime[operation] || 0) + duration;

  if (operation.includes('create')) {
    metrics.snapshotsCreated += count;
  } else if (operation.includes('delete')) {
    metrics.snapshotsDeleted += count;
  }

  logger.info('Metrics', metrics);
}
```

---

## Deployment Guide

### Building the Container

```bash
# Build snapshot service
docker build -f Dockerfile.snapshot-service -t creativewriter2-snapshot-service:latest .

# Tag for registry
docker tag creativewriter2-snapshot-service:latest ghcr.io/marcodroll/creativewriter2-snapshot-service:latest

# Push to registry
docker push ghcr.io/marcodroll/creativewriter2-snapshot-service:latest
```

### Environment Configuration

Create or update `.env`:

```bash
# Existing settings
COUCHDB_USER=admin
COUCHDB_PASSWORD=your-secure-password
TZ=Europe/Berlin

# Snapshot service settings
SNAPSHOT_ENABLED=true
SNAPSHOT_LOG_LEVEL=info

# Optional: Custom schedules (cron format)
# SCHEDULE_GRANULAR=*/15 * * * *
# SCHEDULE_DAILY=0 2 * * *
```

### Starting the Service

```bash
# Start all services including snapshot service
docker compose up -d

# Check snapshot service logs
docker compose logs -f snapshot-service

# Restart just the snapshot service
docker compose restart snapshot-service
```

### Disabling Snapshots Temporarily

```bash
# Option 1: Stop the container
docker compose stop snapshot-service

# Option 2: Set environment variable
SNAPSHOT_ENABLED=false docker compose up -d snapshot-service
```

---

## Storage Estimates

### Per Story Snapshot Size

- Average story: 50 KB
- Snapshot overhead: 2 KB (metadata)
- **Total per snapshot**: ~52 KB

### Total Storage (100 Stories)

| Tier | Snapshots/Story | Total Snapshots | Storage |
|------|----------------|-----------------|---------|
| Granular (15 min, 4h) | 16 | 1,600 | 83 MB |
| Hourly (1h, 24h) | 24 | 2,400 | 125 MB |
| Daily (30 days) | 30 | 3,000 | 156 MB |
| Weekly (12 weeks) | 12 | 1,200 | 62 MB |
| Monthly (12 months) | 12 | 1,200 | 62 MB |
| **Total** | **94** | **9,400** | **488 MB** |

With active pruning and compression: ~250-300 MB for 100 stories

---

## Testing Strategy

### Unit Tests

```bash
npm test
```

Test coverage:
- Snapshot creation logic
- Retention/expiration calculation
- CouchDB queries
- Cron schedule parsing

### Integration Tests

```bash
npm run test:integration
```

Test scenarios:
- End-to-end snapshot creation
- Pruning expired snapshots
- Multi-database support
- Error handling and retry logic

### Manual Testing Checklist

- [ ] Service starts and connects to CouchDB
- [ ] Snapshots created on schedule
- [ ] Expired snapshots are pruned
- [ ] Logs are written correctly
- [ ] Health check passes
- [ ] Service recovers from CouchDB restart
- [ ] Timezone handling works correctly

---

## Security Considerations

### CouchDB Credentials
- Stored in environment variables
- Never logged or exposed
- Use Docker secrets in production

### Database Access
- Service only needs read/write to story databases
- No admin operations required
- Consider separate CouchDB user with limited permissions

### Snapshot Data
- Contains full story content (sensitive)
- Stored in same database as stories
- Inherits CouchDB security model
- No external access

---

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check CouchDB connection
docker compose logs couchdb

# Verify credentials
docker compose exec snapshot-service env | grep COUCHDB
```

**Snapshots not being created:**
```bash
# Check scheduler logs
docker compose logs snapshot-service | grep "Starting.*snapshot"

# Verify cron schedules
docker compose exec snapshot-service cat src/scheduler.js
```

**Too many snapshots:**
```bash
# Manually trigger cleanup
docker compose exec snapshot-service node -e "require('./src/retention-manager').pruneExpiredSnapshots()"

# Adjust retention settings in .env
```

---

## Future Enhancements

### Phase 2
- [ ] Delta/diff compression for storage savings
- [ ] Metrics endpoint for Prometheus
- [ ] Snapshot comparison API
- [ ] Multi-database support (per-user databases)
- [ ] Configurable retention per user

### Phase 3
- [ ] Web UI for snapshot management
- [ ] Manual snapshot triggers via API
- [ ] Snapshot export/download
- [ ] Snapshot search and filtering
- [ ] Analytics dashboard

---

## Success Metrics

- **Reliability**: 99.9% successful snapshot runs
- **Performance**: <5 seconds to snapshot 100 stories
- **Storage**: <500 MB for 100 active stories
- **Uptime**: 99.9% service availability
- **Recovery**: 100% successful restores

---

## References

### Node.js & Docker
- Node.js Docker Best Practices (2025)
- node-cron Documentation
- Alpine Linux Container Guide

### CouchDB
- nano (CouchDB Client) Documentation
- CouchDB Views and Queries
- CouchDB Bulk Operations

### Related Documentation
- `/home/nos/dev/creativewriter/docs/snapshot-and-rollback-design.md` (Client-side approach)
- `/home/nos/dev/creativewriter/docker-compose.yml` (Docker stack)
- `/home/nos/dev/creativewriter/DATABASE_OPTIMIZATION_GUIDE.md`

---

**End of Document**
