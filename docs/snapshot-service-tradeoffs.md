# Snapshot Service - Tradeoffs and Considerations

**Created**: 2025-10-22
**Status**: Analysis Document

---

## Critical Downsides to Consider

### 1. **Multi-Database Complexity** ⚠️

**Problem**: Your current architecture uses per-user databases:
- `creative-writer-stories-anonymous`
- `creative-writer-stories-user123`
- `creative-writer-stories-user456`

The snapshot service needs to:
- Discover ALL user databases dynamically
- Handle new databases being created
- Skip system databases

**Code complexity:**
```javascript
// Need to discover all databases
async function getAllUserDatabases() {
  const couch = getConnection();
  const allDbs = await couch.db.list();

  // Filter for story databases
  return allDbs.filter(db =>
    db.startsWith('creative-writer-stories-') &&
    !db.includes('_replicator')
  );
}

// Then iterate through each
for (const dbName of userDatabases) {
  const db = couch.use(dbName);
  // Create snapshots for this user...
}
```

**Impact**: Medium complexity, manageable but needs careful implementation.

---

### 2. **CouchDB Load** ⚠️⚠️

**Problem**: Potentially massive write operations every 15 minutes.

**Scenario calculation:**
- 100 users × 5 stories each = 500 stories
- Every 15 minutes = 500 snapshot writes
- Per day = 48,000 snapshot documents created
- Plus pruning deletes

**CouchDB impact:**
- Increased I/O during snapshot runs
- Compaction needed more frequently
- Could slow down user operations during snapshot windows
- Disk space growth between compactions

**Mitigation strategies:**
1. Stagger snapshots (don't do all at once)
2. Only snapshot stories modified since last snapshot
3. Run snapshots during low-traffic hours
4. Batch operations efficiently

**Code to check if story changed:**
```javascript
const lastSnapshot = await getLastSnapshot(story._id, tier);
if (lastSnapshot && story.updatedAt <= lastSnapshot.snapshot.updatedAt) {
  // Skip - no changes
  continue;
}
```

**Impact**: High - needs careful optimization for scale.

---

### 3. **Sync Bandwidth Explosion** ⚠️⚠️⚠️

**Problem**: Snapshots sync to ALL user devices via PouchDB replication.

**User's device impact:**
- User has 5 stories on laptop, phone, tablet
- Each story gets 94 snapshots (per retention policy)
- 5 stories × 94 snapshots = **470 snapshot documents**
- Average 52 KB each = **24.4 MB** to sync initially
- Plus ongoing sync for new snapshots every 15 minutes

**Bandwidth calculation:**
```
Initial sync: 24 MB per device
Hourly updates: ~200 KB (4 snapshots × 52 KB)
Daily: 4.8 MB of snapshot data syncing
```

**For user with slow internet**: This could be a MAJOR problem.

**Potential solutions:**
1. **Filtered replication** - don't sync snapshots to clients by default
2. **On-demand snapshot loading** - only fetch when user opens timeline
3. **Server-only snapshots** - keep snapshots only in CouchDB, fetch via API

**Impact**: CRITICAL - could break offline-first architecture or consume excessive bandwidth.

---

### 4. **Storage Growth** ⚠️⚠️

**Problem**: Database size roughly doubles (stories + snapshots).

**Per-user database size:**
```
Before: 10 stories × 50 KB = 500 KB
After: 10 stories + 940 snapshots × 52 KB = 49 MB

That's a 100x increase!
```

**CouchDB disk usage:**
- 100 users × 49 MB = **4.9 GB** (vs 50 MB without snapshots)
- Compaction reduces but doesn't eliminate
- Backup size increases proportionally

**Considerations:**
- Server disk space requirements
- Backup storage costs
- CouchDB compaction frequency
- What about users on free tier with storage limits?

**Impact**: High - significant infrastructure cost increase.

---

### 5. **Security Risk - Admin Credentials** ⚠️⚠️

**Problem**: Snapshot service needs admin access to ALL user databases.

**Security concerns:**
1. Single point of failure - if service compromised, all user data at risk
2. Admin credentials in environment variables
3. Service can read/write any user's stories
4. No audit trail for snapshot service actions

**Better approach:**
```javascript
// Create a limited-privilege CouchDB user
// Only for snapshot operations
PUT /_users/org.couchdb.user:snapshot-service
{
  "name": "snapshot-service",
  "password": "...",
  "roles": ["snapshot-creator"],
  "type": "user"
}

// Grant minimal permissions per database
// Only: read stories, write snapshots, delete old snapshots
```

**Impact**: Medium - manageable with proper CouchDB security setup.

---

### 6. **Offline-Only Users Miss Out** ⚠️

**Problem**: Users who never connect to CouchDB server don't get snapshots.

**Scenarios:**
1. User only uses app locally (no sync setup)
2. User temporarily offline (traveling, etc.)
3. Server downtime means no snapshots created

**For these users:**
- No snapshots are created
- No rollback capability
- Inconsistent experience vs online users

**Hybrid solution needed:**
```javascript
// Client-side fallback for offline users
if (neverSyncedToServer) {
  createLocalSnapshot(); // Store in IndexedDB
}
```

**Impact**: Medium - need hybrid approach for full coverage.

---

### 7. **Mid-Edit Snapshot Timing** ⚠️

**Problem**: 15-minute snapshots might capture incomplete work.

**Example scenario:**
```
14:00 - User starts writing new chapter
14:15 - Snapshot runs - captures half-written paragraph
14:30 - User finishes chapter
```

The 14:15 snapshot has incomplete/nonsensical content.

**Considerations:**
- Snapshot might have syntax errors in user's custom markup
- Could restore to broken state
- User might not want this granularity

**Better approach:**
```javascript
// Add "activity detection"
const lastEditTime = story.updatedAt;
const now = new Date();
const timeSinceEdit = now - lastEditTime;

// Only snapshot if no edit in last 5 minutes (idle)
if (timeSinceEdit > 5 * 60 * 1000) {
  createSnapshot(story);
}
```

**Impact**: Low - easily solved with idle detection.

---

### 8. **Sync Conflicts on Restore** ⚠️⚠️

**Problem**: User restores snapshot while editing on another device.

**Conflict scenario:**
```
Device A (laptop): User actively editing Chapter 3
Device B (phone): User opens story, restores to 1-hour-ago snapshot
Sync happens: CONFLICT!
```

**CouchDB will create conflict documents:**
- Current version (from Device A with new edits)
- Restored version (from Device B)
- User has to manually resolve

**This breaks the smooth experience.**

**Solution:**
```javascript
// Check for active edits before restore
async function safeRestore(snapshotId) {
  const story = await getCurrentStory();

  // Check if modified recently (last 5 minutes)
  if (Date.now() - story.updatedAt < 5 * 60 * 1000) {
    throw new Error('Story is being actively edited. Wait before restoring.');
  }

  // Proceed with restore...
}
```

**Impact**: Medium - needs careful UX and conflict handling.

---

### 9. **Configuration Complexity** ⚠️

**Problem**: How do users control snapshot behavior?

**Questions:**
1. Can user disable snapshots for specific stories?
2. Can user disable snapshots entirely?
3. Different retention policies per user?
4. How to communicate preferences to server?

**Where to store config:**
```javascript
// Option A: In user's database
{
  "_id": "snapshot-config",
  "type": "config",
  "enabled": true,
  "excludeStories": ["story-123", "story-456"],
  "retentionPolicy": "aggressive" | "moderate" | "minimal"
}

// Option B: In CouchDB _users database
// Option C: Separate configuration database
```

**Service must read these configs:**
```javascript
async function shouldSnapshot(story, userConfig) {
  if (!userConfig.enabled) return false;
  if (userConfig.excludeStories.includes(story._id)) return false;
  // ...
}
```

**Impact**: Medium - adds complexity to service logic.

---

### 10. **Operational Burden** ⚠️

**Problem**: Another service to monitor, maintain, debug.

**What can go wrong:**
- Service crashes, no snapshots created
- CouchDB connection issues
- Memory leaks in long-running Node.js process
- Cron schedule misconfiguration
- Time zone issues (daylight saving time!)

**Need to implement:**
- Health checks and alerting
- Metrics (Prometheus/Grafana)
- Error notifications
- Automatic restart on failure
- Log rotation
- Performance monitoring

**Operational questions:**
```
- Who gets paged if snapshot service fails?
- How to detect "silent failures" (service running but not creating snapshots)?
- How to recover if service is down for a day?
- Should it backfill missed snapshots?
```

**Impact**: Medium - standard DevOps overhead.

---

### 11. **Testing Complexity** ⚠️

**Problem**: Hard to test time-based operations.

**Testing challenges:**
1. Can't wait 15 minutes in unit tests
2. Need to mock cron schedules
3. Hard to test pruning without waiting days
4. Need test databases for multiple users
5. Time zone testing is complex

**Test approach:**
```javascript
// Need to mock time
jest.useFakeTimers();

// Need to override schedules
process.env.SCHEDULE_GRANULAR = '*/1 * * * *'; // Every minute for testing

// Need test data
await createTestStories(100);
await createTestSnapshots(1000);

// Advance time
jest.advanceTimersByTime(15 * 60 * 1000);
```

**Impact**: Low - solvable with good test infrastructure.

---

### 12. **Cost at Scale** ⚠️⚠️

**Problem**: Costs increase significantly with users.

**Infrastructure costs:**
```
1,000 users × 10 stories × 94 snapshots = 940,000 snapshot documents
× 52 KB average = 48 GB storage
× $0.10/GB/month (cloud storage) = $4.80/month

Plus:
- CouchDB compute time for writes
- Bandwidth for replication
- Backup storage
```

**At 10,000 users**: ~$480/month just for snapshot storage.

**Free tier implications:**
- Can you afford to give free users unlimited snapshots?
- Need tiered pricing? (Pro users get more history)
- Or limit snapshots for free users?

**Impact**: High for hosted/SaaS model, low for self-hosted.

---

## Alternative Architectures to Consider

### Option A: Hybrid Approach
```
- Server creates daily/weekly/monthly snapshots only
- Client creates granular (15-min) snapshots locally
- Best of both worlds
```

**Pros:**
- Reduces server load and storage by 90%
- Granular snapshots still available offline
- Long-term snapshots reliable

**Cons:**
- More complex implementation
- Client-side storage still needed

---

### Option B: On-Demand Snapshots Only
```
- No automatic snapshots
- User manually creates snapshots before major changes
- Snapshot service only handles retention/cleanup
```

**Pros:**
- Minimal server load
- User controls exactly what's saved
- Much simpler

**Cons:**
- Users forget to create snapshots
- Defeats "automatic safety net" purpose

---

### Option C: Differential Snapshots
```
- First snapshot: full story copy
- Subsequent snapshots: only changes (diffs)
```

**Pros:**
- Massive storage savings (90%+)
- Faster snapshot creation
- Less bandwidth

**Cons:**
- Complex to implement
- Slower to restore (must replay diffs)
- More CPU intensive

**Implementation:**
```javascript
const diff = require('diff');

const previousSnapshot = await getLastSnapshot(story._id);
const delta = diff.createPatch(
  'story',
  JSON.stringify(previousSnapshot.snapshot),
  JSON.stringify(currentStory)
);

// Store delta instead of full copy
snapshot.delta = delta; // Much smaller!
```

---

### Option D: Filtered Replication (RECOMMENDED)
```
- Snapshots stay on server only
- Client fetches snapshots on-demand via API
- No automatic sync of snapshot documents
```

**Implementation:**
```javascript
// In PouchDB sync setup
db.sync(remoteDb, {
  live: true,
  retry: true,
  filter: function(doc) {
    // Don't sync snapshot documents to client
    return doc.type !== 'story-snapshot';
  }
});

// When user opens snapshot timeline
async function loadSnapshots(storyId) {
  // Fetch directly from CouchDB via HTTP
  const response = await fetch(
    `${couchUrl}/_design/snapshots/_view/by_story?key="${storyId}"`
  );
  return response.json();
}
```

**Pros:**
- Solves bandwidth problem entirely
- Solves client storage problem
- Snapshots still accessible
- Fast client sync

**Cons:**
- Snapshots not available offline
- Requires server connection to view/restore

**Impact**: This might be the BEST compromise.

---

## Recommendations

### Must-Have Mitigations

1. **Use Filtered Replication** ⭐⭐⭐
   - Don't sync snapshots to clients automatically
   - Fetch on-demand only
   - Saves bandwidth and client storage

2. **Implement Change Detection** ⭐⭐⭐
   - Only snapshot if story actually changed
   - Reduces unnecessary writes by 80%+

3. **Stagger Snapshot Operations** ⭐⭐
   - Don't snapshot all stories at once
   - Spread load over the 15-minute window
   - Prevents CouchDB spikes

4. **Add Configuration Options** ⭐⭐
   - Let users disable snapshots per story
   - Let users choose retention policy
   - Respect user preferences

5. **Monitor and Alert** ⭐
   - Track snapshot success rate
   - Alert on failures
   - Dashboard for operations team

### Consider for V2

6. **Differential/Delta Snapshots**
   - Implement later for storage optimization
   - Only if storage becomes a real problem

7. **Client-Side Fallback**
   - Local snapshots for offline users
   - Hybrid approach for best coverage

8. **Advanced Features**
   - Per-user retention policies
   - Snapshot tagging/labeling
   - Automated cleanup based on storage quota

---

## Decision Matrix

| Factor | Server-Side | Client-Side | Hybrid |
|--------|-------------|-------------|--------|
| Reliability | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Offline support | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Client impact | ⭐⭐⭐ | ⭐ | ⭐⭐ |
| Storage cost | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| Bandwidth | ⭐ (with filter) | ⭐⭐⭐ | ⭐⭐ |
| Complexity | ⭐⭐ | ⭐⭐ | ⭐ |
| Scalability | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## Bottom Line

**Server-side snapshots ARE viable**, but you MUST:

1. ✅ Use **filtered replication** (don't sync snapshots to clients)
2. ✅ Implement **change detection** (only snapshot modified stories)
3. ✅ **Stagger operations** (prevent load spikes)
4. ✅ Add **user configuration** (let users opt-out)
5. ✅ **Monitor closely** (watch for issues at scale)

**Without these mitigations**, you'll hit problems around:
- 100+ active users (bandwidth issues)
- 1000+ stories (CouchDB load issues)
- Limited server resources (storage costs)

**With proper implementation**, the server-side approach scales to thousands of users while providing reliable, automatic snapshots.

---

## Next Steps

Before implementing, decide on:

1. **Target scale**: How many users? How many stories?
2. **Replication strategy**: Filtered (recommended) or full sync?
3. **Retention policy**: Conservative (less storage) or aggressive (more history)?
4. **User controls**: What level of configuration to expose?
5. **Monitoring**: What metrics matter most?

Once these are decided, the implementation can be optimized accordingly.

---

**End of Analysis**
