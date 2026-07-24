import cron from "node-cron";
import crypto from "node:crypto";
import os from "node:os";
import ContestService from "../modules/contests/service.js";
import SyncLock from "../models/SyncLock.js";

const JOB_NAME = "contestSync";
// Must comfortably exceed the slowest expected sync duration — this is the
// safety net that recovers the lease automatically if a holder crashes or
// hangs. Renewal (below) keeps this from ever being hit during a healthy
// long-running sync; it's purely a recovery backstop.
const LOCK_TTL_MS = 10 * 60 * 1000;
// Renew at half the TTL so a renewal can be missed once (e.g. one slow
// Mongo round trip) without the lease lapsing before the next attempt.
const RENEWAL_INTERVAL_MS = LOCK_TTL_MS / 2;
const INSTANCE_ID = `${os.hostname()}:${process.pid}`;

/**
 * Chosen strategy: DB-backed lease (Option 2 in issue #277), since MongoDB
 * is already a project dependency and requires no new infrastructure.
 *
 * - Acquisition is a single atomic findOneAndUpdate (no read-then-write race).
 * - Each acquisition is tagged with a unique ownerId, so only the instance
 *   that acquired the lease can release or renew it.
 * - lockedUntil bounds how long a lease can be held without renewal, so a
 *   crashed or hung holder cannot block future syncs indefinitely.
 * - While a sync is actively running, the lease is periodically RENEWED
 *   (see RENEWAL_INTERVAL_MS) so a run that legitimately takes longer than
 *   LOCK_TTL_MS does not lose its lease to another instance mid-run. Only a
 *   holder that has actually crashed/hung (and therefore stopped renewing)
 *   ever lets the TTL lapse.
 *
 * Deployment note: this is safe for any topology sharing one MongoDB
 * (PM2 cluster mode, container replicas, rolling deploys, multiple dynos).
 * If the team later moves sync to a dedicated worker process (Option 1),
 * this lock logic can be removed and the cron moved there exclusively.
 */

export const acquireLock = async (jobName, ttlMs, ownerId) => {
  const now = new Date();
  try {
    const result = await SyncLock.findOneAndUpdate(
      { jobName, lockedUntil: { $lt: now } },
      { jobName, ownerId, lockedUntil: new Date(now.getTime() + ttlMs) },
      { upsert: true, returnDocument: "after" }
    );
    return result?.ownerId === ownerId;
  } catch (err) {
    if (err.code === 11000) {
      // Another instance's upsert won the atomic race for this tick.
      return false;
    }
    console.warn(`[Contest Sync] Lock acquisition failed (${jobName}):`, err.message);
    return false;
  }
};

/**
 * Extends the current lease while a run is still active. Scoped to
 * jobName + ownerId so this can only ever renew a lease this instance
 * actually holds — it is a no-op (not an error) if the lease was already
 * lost (e.g. renewal was missed for an entire TTL window and another
 * instance took over).
 */
export const renewLock = async (jobName, ttlMs, ownerId) => {
  try {
    const now = new Date();
    await SyncLock.updateOne(
      { jobName, ownerId },
      { lockedUntil: new Date(now.getTime() + ttlMs) }
    );
  } catch (err) {
    console.warn(`[Contest Sync] Lock renewal failed (${jobName}):`, err.message);
  }
};

/**
 * Best-effort early release so the next tick (or another instance) doesn't
 * have to wait out the full TTL. Scoped to ownerId — if the lease already
 * expired and was taken over by someone else, this is a safe no-op.
 */
export const releaseLock = async (jobName, ownerId) => {
  try {
    await SyncLock.deleteOne({ jobName, ownerId });
  } catch (err) {
    // Non-fatal: the lease will simply expire naturally via TTL.
    console.warn(`[Contest Sync] Lock release failed (${jobName}):`, err.message);
  }
};

/**
 * Builds a single, stateful runSync function. All Mongo/side-effecting
 * dependencies are injectable so the scheduler's execution paths (synced,
 * failed-with-release, skipped-locked, skipped-running) can be tested
 * deterministically without a real database or cron.
 *
 * Returns the runner function AND exposes getIsRunning for tests that
 * need to assert on in-flight state.
 */
export const createRunSync = ({
  jobName,
  ttlMs,
  renewalIntervalMs,
  instanceId,
  syncFn,
  acquire = acquireLock,
  release = releaseLock,
  renew = renewLock,
}) => {
  let isRunning = false;

  const runSync = async () => {
    const runId = crypto.randomUUID();

    if (isRunning) {
      console.log(`[Contest Sync] Skipped (run ${runId}) — previous sync on this instance is still in progress.`);
      return { outcome: "skipped-running", runId };
    }

    const ownerId = `${instanceId}:${runId}`;
    const acquired = await acquire(jobName, ttlMs, ownerId);
    if (!acquired) {
      console.log(`[Contest Sync] Skipped (run ${runId}) — another instance holds the lease.`);
      return { outcome: "skipped-locked", runId };
    }

    isRunning = true;
    console.log(`[Contest Sync] Acquired lease (run ${runId}, owner ${ownerId}) — starting sync.`);

    const heartbeat = setInterval(() => {
      renew(jobName, ttlMs, ownerId);
    }, renewalIntervalMs);

    try {
      const { synced } = await syncFn();
      console.log(`[Contest Sync] Run ${runId} synced ${synced} Codeforces contest(s).`);
      return { outcome: "synced", runId, synced };
    } catch (err) {
      console.error(`[Contest Sync] Run ${runId} failed:`, err.message);
      return { outcome: "failed", runId, error: err.message };
    } finally {
      clearInterval(heartbeat);
      isRunning = false;
      await release(jobName, ownerId);
    }
  };

  return { runSync, getIsRunning: () => isRunning };
};

export const startContestSyncJob = async () => {
  // Ensure the unique index on SyncLock.jobName is built before any lock
  // acquisition happens. If this fails, contest sync is disabled for this
  // process rather than taking down the whole server — sync is a
  // background convenience, not a request-serving dependency.
  try {
    await SyncLock.init();
  } catch (err) {
    console.error("[Contest Sync] Failed to initialize SyncLock index — contest sync disabled for this instance:", err.message);
    return;
  }

  const { runSync } = createRunSync({
    jobName: JOB_NAME,
    ttlMs: LOCK_TTL_MS,
    renewalIntervalMs: RENEWAL_INTERVAL_MS,
    instanceId: INSTANCE_ID,
    syncFn: () => ContestService.syncCodeforcesContests(),
  });

  await runSync();
  cron.schedule("0 * * * *", runSync);
};
