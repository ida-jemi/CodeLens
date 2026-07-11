import mongoose from "mongoose";

/**
 * Distributed lock used to ensure only one running instance executes a
 * given scheduled job (e.g. contest sync) per tick, even when the app is
 * horizontally scaled across multiple processes/dynos.
 *
 * A doc is "locked" while `lockedUntil` is in the future. Acquiring the
 * lock is a single atomic `findOneAndUpdate`, so there is no read-then-write
 * race between instances.
 */
const SyncLockSchema = new mongoose.Schema(
  {
    jobName: { type: String, unique: true, required: true },
    lockedUntil: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("SyncLock", SyncLockSchema);
