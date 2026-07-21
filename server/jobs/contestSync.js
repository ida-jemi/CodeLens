import cron from "node-cron";
import crypto from "node:crypto";
import os from "node:os";
import ContestService from "../modules/contests/service.js";
import SyncLock from "../models/SyncLock.js";

const JOB_NAME = "contestSync";
// Must comfortably exceed the slowest expected sync duration — this is the
// safety net that recovers the lease automatically if a holder crashes.
const LOCK_TTL_MS = 10 * 60 * 1000;
const INSTANCE_ID = `${os.hostname()}:${process.pid}`;

/**
 * Chosen strategy: DB-backed lease (Option 2 in issue #277), since MongoDB
 * is already a project dependency and requires no new infrastructure.
 *
 * - Acquisition is a single atomic findOneAndUpdate (no read-then-write race).
 * - Each acquisition is tagged with a unique ownerId, so only the instance
 *   that acquired the lease can release it early.
 * - lockedUntil bounds how long a lease can be held, so a crashed or hung
 *   holder cannot block future syncs indefinitely.
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

  // In-process guard: stops THIS instance from starting a second sync if
  // the previous run is still in flight when the next tick fires.
  let isRunning = false;

  const runSync = async () => {
    const runId = crypto.randomUUID();

    if (isRunning) {
      console.log(`[Contest Sync] Skipped (run ${runId}) — previous sync on this instance is still in progress.`);
      return;
    }

    const ownerId = `${INSTANCE_ID}:${runId}`;
    const acquired = await acquireLock(JOB_NAME, LOCK_TTL_MS, ownerId);
    if (!acquired) {
      console.log(`[Contest Sync] Skipped (run ${runId}) — another instance holds the lease.`);
      return;
    }

    isRunning = true;
    console.log(`[Contest Sync] Acquired lease (run ${runId}, owner ${ownerId}) — starting sync.`);

    try {
      const { synced } = await ContestService.syncCodeforcesContests();
      console.log(`[Contest Sync] Run ${runId} synced ${synced} Codeforces contest(s).`);
    } catch (err) {
      console.error(`[Contest Sync] Run ${runId} failed:`, err.message);
    } finally {
      isRunning = false;
      await releaseLock(JOB_NAME, ownerId);
    }
  };

  await runSync();
  cron.schedule("0 * * * *", runSync);
};
