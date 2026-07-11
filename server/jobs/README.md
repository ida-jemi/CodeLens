# Scheduled Jobs

## Contest sync (`contestSync.js`)

**Strategy:** Database-backed lease (MongoDB), not a dedicated worker process or queue.

Every backend instance calls `startContestSyncJob()` on boot. Each instance
independently registers the same hourly `node-cron` schedule, but before
running the actual sync, an instance must atomically acquire a lease in the
`synclocks` collection (`SyncLock` model, `jobName: "contestSync"`).

- Only the instance holding the lease runs `syncCodeforcesContests()`.
- The lease is released immediately after the run finishes (success or
  failure) so the next tick isn't blocked waiting on the full TTL.
- If a holder crashes or hangs, the lease auto-expires after `LOCK_TTL_MS`
  (currently 10 minutes) and the next tick on another instance can take over.
- A per-instance in-memory flag additionally prevents the *same* instance
  from starting an overlapping sync if one run takes longer than expected.

**Deployment implication:** no special configuration is needed to run this
app with multiple replicas (PM2 cluster mode, container replicas, rolling
deploys, multiple dynos) — all instances share one MongoDB and coordinate
through it automatically.

**If this ever needs to change:** if sync duration grows significantly, or
side effects become non-idempotent (emails, push notifications), consider
moving to a dedicated worker/scheduler process (see issue #277, Option 1)
so web instances are no longer cron owners at all.

## Local validation

To manually confirm the lease behaves correctly with multiple instances:
1. Run `node server.js` in two terminals against the same MongoDB.
2. Confirm one logs `Acquired lease ... starting sync` and the other logs
   `Skipped ... another instance holds the lease`.
3. Check the `synclocks` collection has exactly one document for
   `jobName: "contestSync"`.
   