# Creative Writer Snapshot Service

Automated snapshot creation and retention management service for Creative Writer stories.

## Overview

This service runs as a separate Docker container and creates time-based snapshots of all stories in CouchDB databases on a regular schedule. Snapshots are stored server-side only and are accessed by clients on-demand via HTTP queries.

## Features

- **Automated snapshots** at multiple retention tiers:
  - Granular: Every 15 minutes (kept for 4 hours)
  - Hourly: Every hour (kept for 24 hours)
  - Daily: Once per day (kept for 30 days)
  - Weekly: Once per week (kept for 12 weeks)
  - Monthly: Once per month (kept for 12 months)

- **Intelligent snapshot creation**:
  - Only snapshots stories that have changed
  - Waits for idle period (no active editing)
  - Discovers all user databases automatically
  - Processes stories in batches

- **Automatic retention management**:
  - Prunes expired snapshots daily
  - Enforces per-story snapshot limits
  - Provides snapshot statistics

- **Server-side only**:
  - Snapshots stay in CouchDB
  - Not synced to client browsers (filtered replication)
  - Accessible via HTTP queries on-demand

## Architecture

```
Snapshot Service (Node.js)
├── Scheduler (node-cron)
│   ├── Granular snapshots (*/15 * * * *)
│   ├── Hourly snapshots (0 * * * *)
│   ├── Daily snapshots (0 2 * * *)
│   ├── Weekly snapshots (0 3 * * 0)
│   ├── Monthly snapshots (0 4 1 * *)
│   └── Cleanup (0 5 * * *)
│
├── Snapshot Creator
│   ├── Discover user databases
│   ├── Filter story documents
│   ├── Check for changes
│   └── Create snapshot documents
│
├── Retention Manager
│   ├── Query expired snapshots
│   ├── Bulk delete operations
│   └── Statistics collection
│
└── CouchDB Client
    ├── Connection management
    ├── View queries
    └── Bulk operations
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COUCHDB_HOST` | `couchdb` | CouchDB hostname |
| `COUCHDB_PORT` | `5984` | CouchDB port |
| `COUCHDB_USER` | `admin` | CouchDB username |
| `COUCHDB_PASSWORD` | `password` | CouchDB password |
| `TZ` | `Europe/Berlin` | Timezone for schedules |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `SNAPSHOT_ENABLED` | `true` | Enable/disable snapshot creation |
| `DATABASE_PATTERN` | `creative-writer-stories` | Database name pattern to match |
| `MAX_SNAPSHOTS_PER_STORY` | `500` | Maximum snapshots per story (safety limit) |
| `IDLE_THRESHOLD_MINUTES` | `5` | Wait time after last edit before snapshot |
| `BATCH_SIZE` | `10` | Process stories in batches of N |

### Schedule Overrides

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEDULE_GRANULAR` | `*/15 * * * *` | Cron for 15-min snapshots |
| `SCHEDULE_HOURLY` | `0 * * * *` | Cron for hourly snapshots |
| `SCHEDULE_DAILY` | `0 2 * * *` | Cron for daily snapshots |
| `SCHEDULE_WEEKLY` | `0 3 * * 0` | Cron for weekly snapshots |
| `SCHEDULE_MONTHLY` | `0 4 1 * *` | Cron for monthly snapshots |
| `SCHEDULE_CLEANUP` | `0 5 * * *` | Cron for cleanup |

## Development

### Local Development

```bash
cd snapshot-service
npm install
npm run dev
```

### Testing

```bash
# Set test environment variables
export COUCHDB_HOST=localhost
export COUCHDB_PORT=5984
export COUCHDB_USER=admin
export COUCHDB_PASSWORD=password
export LOG_LEVEL=debug

# Run service
npm start
```

### Building Docker Image

```bash
# From project root
docker build -f Dockerfile.snapshot-service -t creativewriter2-snapshot-service:latest .

# Tag for registry
docker tag creativewriter2-snapshot-service:latest ghcr.io/marcodroll/creativewriter2-snapshot-service:latest

# Push to registry
docker push ghcr.io/marcodroll/creativewriter2-snapshot-service:latest
```

## Deployment

### With Docker Compose

The service is included in the main `docker-compose.yml`:

```bash
# Start all services including snapshot service
docker compose up -d

# View snapshot service logs
docker compose logs -f snapshot-service

# Restart snapshot service
docker compose restart snapshot-service

# Stop snapshot service temporarily
docker compose stop snapshot-service
```

### Disabling Snapshots

```bash
# Option 1: Stop the container
docker compose stop snapshot-service

# Option 2: Set environment variable
SNAPSHOT_ENABLED=false docker compose up -d snapshot-service
```

## Monitoring

### View Logs

```bash
# Real-time logs
docker compose logs -f snapshot-service

# Last 100 lines
docker compose logs --tail=100 snapshot-service

# Log file (inside container)
docker compose exec snapshot-service cat /var/log/snapshot-service/snapshots.log
```

### Health Check

```bash
# Check container health
docker compose ps snapshot-service

# Manual health check
docker compose exec snapshot-service node src/health-check.js
```

### Statistics

The service logs snapshot statistics every 6 hours:

```json
{
  "totalDatabases": 3,
  "totalSnapshots": 142,
  "byTier": {
    "granular": 48,
    "hourly": 24,
    "daily": 30,
    "weekly": 12,
    "monthly": 12,
    "manual": 16
  },
  "byDatabase": {
    "creative-writer-stories-user1": { "total": 94 },
    "creative-writer-stories-user2": { "total": 48 }
  }
}
```

## Troubleshooting

### Service won't start

```bash
# Check CouchDB is running
docker compose ps couchdb

# Check CouchDB logs
docker compose logs couchdb

# Verify credentials
docker compose exec snapshot-service env | grep COUCHDB
```

### No snapshots being created

```bash
# Check if enabled
docker compose logs snapshot-service | grep "DISABLED"

# Check schedule logs
docker compose logs snapshot-service | grep "CRON"

# Check for errors
docker compose logs snapshot-service | grep ERROR
```

### Too many snapshots

```bash
# Manually trigger cleanup
docker compose exec snapshot-service node -e "require('./src/retention-manager').pruneExpiredSnapshotsForAllDatabases()"

# Adjust retention in .env
echo "MAX_SNAPSHOTS_PER_STORY=250" >> .env
docker compose up -d snapshot-service
```

### High CouchDB load

```bash
# Reduce snapshot frequency (edit docker-compose.yml)
environment:
  - SCHEDULE_GRANULAR=*/30 * * * *  # Every 30 minutes instead of 15

# Increase idle threshold
environment:
  - IDLE_THRESHOLD_MINUTES=10  # Wait 10 minutes after last edit

# Reduce batch size
environment:
  - BATCH_SIZE=5  # Process fewer stories at once
```

## Client Integration

Clients use filtered replication to exclude snapshots from sync:

```typescript
// In database.service.ts
db.sync(remoteDb, {
  filter: (doc) => doc.type !== 'story-snapshot'
});
```

Clients query snapshots on-demand via HTTP when user opens version history:

```typescript
// Query snapshots directly from CouchDB
const response = await fetch(
  `${couchUrl}/_design/snapshots/_view/by_story_and_date?` +
  `startkey=["${storyId}"]&endkey=["${storyId}",{}]&include_docs=true`
);
```

See `/docs/snapshot-server-only-implementation.md` for complete client implementation.

## Performance

### Expected Load

For 100 active users with 5 stories each (500 stories):

- **Granular snapshots**: ~500 writes every 15 minutes
- **Daily operations**: ~48,000 snapshot documents created/deleted
- **Storage**: ~5 GB (with retention policies)
- **CouchDB impact**: Moderate during snapshot windows

### Optimization Tips

1. **Stagger operations**: Adjust schedules to avoid overlapping
2. **Increase idle threshold**: Only snapshot truly inactive stories
3. **Reduce granular retention**: Keep 2 hours instead of 4
4. **Batch size**: Process fewer stories simultaneously

## Security

- Service requires CouchDB admin credentials
- Credentials stored in environment variables (Docker secrets recommended)
- Service has read/write access to all user databases
- No external network access required
- Logs may contain story IDs but not content

## License

Same as Creative Writer main application.
