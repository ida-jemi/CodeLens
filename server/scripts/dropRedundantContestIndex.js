import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";

/**
 * One-off migration: drops the standalone `contestId_1` index on the
 * contests collection, if present. Mongoose schema changes never
 * automatically drop existing indexes in production — this must be run
 * explicitly against each environment (staging, production) after the
 * schema change deploys.
 *
 * Safe to run multiple times — it's a no-op if the index is already gone.
 *
 * Usage: node scripts/dropRedundantContestIndex.js
 */
const run = async () => {
  await connectDB();
  const collection = mongoose.connection.collection("contests");
  const indexes = await collection.indexes();

  const standalone = indexes.find(
    (idx) => JSON.stringify(idx.key) === JSON.stringify({ contestId: 1 })
  );

  if (standalone) {
    await collection.dropIndex(standalone.name);
    console.log(`Dropped redundant index: ${standalone.name}`);
  } else {
    console.log("No standalone contestId index found — nothing to do.");
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Failed to drop index:", err);
  process.exit(1);
});
