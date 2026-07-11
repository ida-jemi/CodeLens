import cron from "node-cron";
import ContestService from "../modules/contests/service.js";
import SyncLock from "../models/SyncLock.js";

const JOB_NAME = "contestSync";
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes — enough for a sync to finish

/**
 * Atomically try to acquire the lock for this job. Returns true if this
 * instance won the lock and should run the sync, false otherwise.
 *
 * The findOneAndUpdate below is a single atomic server-side operation, so
 * two instances racing to acquire the lock at the same moment cannot both
 * succeed. Only the instance whose write actually satisfies the filter
 * ({ lockedUntil: { $lt: now } } OR no doc yet) gets the updated document.
 */
const acquireLock = async (jobName, ttlMs) => {
  const now = new Date();
  try {
    await SyncLock.findOneAndUpdate(
      { jobName, lockedUntil: { $lt: now } },
      { jobName, lockedUntil: new Date(now.getTime() + ttlMs) },
      { upsert: true, returnDocument: "after" }
    );
    return true;
  } catch (err) {
    // Duplicate key error (11000) means another instance won the race and
    // upserted first — this is expected, not a real failure.
    if (err.code === 11000) {
      return false;
    }
    // Any other error (e.g. DB unreachable) should degrade gracefully:
    // skip this tick rather than crash the process.
    console.warn("[Contest Sync] Lock acquisition failed, skipping tick:", err.message);
    return false;
  }
};

export const startContestSyncJob = async () => {
  // Ensure the unique index on SyncLock.jobName is built before any lock
  // acquisition happens — otherwise the very first concurrent upsert race
  // (right after server boot) isn't guaranteed to be exclusive.
  await SyncLock.init();

  const runSync = async () => {
    const acquired = await acquireLock(JOB_NAME, LOCK_TTL_MS);
    if (!acquired) {
      console.log("[Contest Sync] Skipped — another instance holds the lock.");
      return;
    }

    try {
      const { synced } = await ContestService.syncCodeforcesContests();
      console.log(`[Contest Sync] Synced ${synced} Codeforces contest(s).`);
    } catch (err) {
      console.error("[Contest Sync Error]", err.message);
    }
  };

  runSync();
  cron.schedule("0 * * * *", runSync);
};
