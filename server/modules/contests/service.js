import ApiError from "../../utils/ApiError.js";
import ContestRepository from "./repository.js";
import { cfGetContestList } from "../../utils/codeforcesApi.js";

const parseDivision = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("div. 1") && n.includes("div. 2")) return "Div. 1 + 2";
  if (n.includes("div. 1")) return "Div. 1";
  if (n.includes("div. 2")) return "Div. 2";
  if (n.includes("div. 3")) return "Div. 3";
  if (n.includes("div. 4")) return "Div. 4";
  if (n.includes("educational")) return "Educational";
  if (n.includes("global")) return "Global";
  if (n.includes("kotlin")) return "Kotlin Heroes";
  if (n.includes("icpc")) return "ICPC";
  return "Other";
};

const normalizeContest = (c) => ({
  platform: "codeforces",
  contestId: c.id,
  name: c.name,
  type: c.type,
  phase: c.phase,
  division: parseDivision(c.name),
  durationSeconds: c.durationSeconds,
  startTimeSeconds: c.startTimeSeconds,
  relativeTimeSeconds: c.relativeTimeSeconds,
  lastSyncedAt: new Date(),
});

class ContestService {
  static async syncCodeforcesContests() {
    const contests = await cfGetContestList(false);

    const relevant = contests.filter((c) =>
      ["BEFORE", "CODING", "FINISHED"].includes(c.phase)
    );

    const finished = relevant
      .filter((c) => c.phase === "FINISHED")
      .sort((a, b) => b.startTimeSeconds - a.startTimeSeconds)
      .slice(0, 20);

    const upcomingOrRunning = relevant.filter((c) => c.phase !== "FINISHED");

    const docs = [...upcomingOrRunning, ...finished].map(normalizeContest);

    await ContestRepository.bulkUpsertContests(docs);
    await ContestRepository.pruneStaleReminders("codeforces");

    return { synced: docs.length };
  }

  static async getUpcomingContests() {
    return ContestRepository.getUpcomingContests("codeforces");
  }

  static async getUserReminderIds(userId) {
    return ContestRepository.getReminderContestIds(userId, "codeforces");
  }

  static async addReminder(userId, contestId) {
    const contest = await ContestRepository.findByContestId("codeforces", contestId);
    if (!contest) {
      throw new ApiError(404, "Contest not found. It may have already started or ended.");
    }
    if (!["BEFORE", "CODING"].includes(contest.phase)) {
      throw new ApiError(400, "Reminders can only be set for upcoming or running contests.");
    }

    await ContestRepository.addReminder(userId, "codeforces", contestId);
    return { message: `Reminder set for "${contest.name}".`, contestId };
  }

  static async removeReminder(userId, contestId) {
    await ContestRepository.removeReminder(userId, "codeforces", contestId);
    return { message: "Reminder removed.", contestId };
  }

  static async getActiveReminders(userId) {
    return ContestRepository.getActiveReminderContests(userId, "codeforces");
  }

  static async markReminderNotified(userId, contestId) {
    await ContestRepository.markNotified(userId, "codeforces", contestId);
    return { message: "Reminder marked as shown.", contestId };
  }
}

export default ContestService;
