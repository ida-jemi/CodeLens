import mongoose from "mongoose";

/**
 * A user's opt-in to be reminded about a specific upcoming contest.
 * One document per (user, contest) pair.
 */
const ContestReminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["codeforces"],
      default: "codeforces",
      required: true,
    },
    contestId: { type: Number, required: true },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ContestReminderSchema.index(
  { user: 1, platform: 1, contestId: 1 },
  { unique: true }
);

export default mongoose.model("ContestReminder", ContestReminderSchema);
