import mongoose from "mongoose";

/**
 * Caches the Codeforces `contest.list` API response so the frontend never
 * has to hit Codeforces directly (avoids rate-limiting, keeps load times fast).
 * Refreshed hourly by `server/jobs/contestSync.js`.
 */
const ContestSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["codeforces"],
      default: "codeforces",
      required: true,
      index: true,
    },
    // NOTE: no standalone index here. Every current query pattern that
    // filters on contestId also filters on platform in the same query
    // (see repository.js: findByContestId, bulkUpsertContests' upsert
    // filter) — the compound unique index below already fully covers
    // those lookups via its leftmost-prefix behavior. A separate index
    // on contestId alone would be redundant and only add write overhead.
    // See server/modules/contests/INDEXES.md for the full rationale and
    // how to safely apply this in an existing production database.
    contestId: { type: Number, required: true },
    name: { type: String, required: true },
    type: { type: String, default: "CF" },
    phase: { type: String, required: true, index: true },
    division: { type: String, default: "Other" },
    durationSeconds: { type: Number, required: true },
    startTimeSeconds: { type: Number, required: true, index: true },
    relativeTimeSeconds: { type: Number },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ContestSchema.index({ platform: 1, contestId: 1 }, { unique: true });

export default mongoose.model("Contest", ContestSchema);
