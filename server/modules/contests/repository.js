import Contest from "../../models/Contest.js";
import ContestReminder from "../../models/ContestReminder.js";

class ContestRepository {
  static async bulkUpsertContests(contests) {
    if (!contests.length) return;

    const ops = contests.map((c) => ({
      updateOne: {
        filter: { platform: c.platform, contestId: c.contestId },
        update: { $set: c },
        upsert: true,
      },
    }));

    return Contest.bulkWrite(ops, { ordered: false });
  }

  static async getUpcomingContests(platform = "codeforces") {
    return Contest.find({
      platform,
      phase: { $in: ["BEFORE", "CODING"] },
    })
      .sort({ startTimeSeconds: 1 })
      .lean();
  }

  static async findByContestId(platform, contestId) {
    return Contest.findOne({ platform, contestId }).lean();
  }

  static async addReminder(userId, platform, contestId) {
    return ContestReminder.findOneAndUpdate(
      { user: userId, platform, contestId },
      { $setOnInsert: { user: userId, platform, contestId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  static async removeReminder(userId, platform, contestId) {
    return ContestReminder.findOneAndDelete({ user: userId, platform, contestId });
  }

  static async getReminderContestIds(userId, platform = "codeforces") {
    const reminders = await ContestReminder.find({ user: userId, platform })
      .select("contestId -_id")
      .lean();
    return reminders.map((r) => r.contestId);
  }

  static async getActiveReminderContests(userId, platform = "codeforces") {
    const reminders = await ContestReminder.find({ user: userId, platform }).lean();
    if (!reminders.length) return [];

    const contestIds = reminders.map((r) => r.contestId);
    const contests = await Contest.find({
      platform,
      contestId: { $in: contestIds },
      phase: { $in: ["BEFORE", "CODING"] },
    }).lean();

    const reminderByContestId = new Map(reminders.map((r) => [r.contestId, r]));

    return contests
      .map((contest) => ({
        ...contest,
        notifiedAt: reminderByContestId.get(contest.contestId)?.notifiedAt ?? null,
      }))
      .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  }

  static async markNotified(userId, platform, contestId) {
    return ContestReminder.findOneAndUpdate(
      { user: userId, platform, contestId },
      { $set: { notifiedAt: new Date() } }
    );
  }

  static async pruneStaleReminders(platform = "codeforces") {
    const finishedContestIds = await Contest.find({
      platform,
      phase: "FINISHED",
    })
      .select("contestId -_id")
      .lean();

    if (!finishedContestIds.length) return;

    await ContestReminder.deleteMany({
      platform,
      contestId: { $in: finishedContestIds.map((c) => c.contestId) },
    });
  }
}

export default ContestRepository;
