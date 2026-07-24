import ApiError from "../../utils/ApiError.js";
import ContestRepository from "./repository.js";
import { cfGetContestList } from "../../utils/codeforcesApi.js";

// NOTE: any value returned here must have a corresponding entry in
// frontend/src/components/contests/UpcomingContestsList.jsx's DIVISIONS array.
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
  /**
   * @param {Object} [deps] - injectable dependencies, for testing only.
   *   Production callers should never need to pass this.
   * @param {Function} [deps.fetchContests] - defaults to cfGetContestList.
   */
  static async syncCodeforcesContests({ fetchContests = cfGetContestList } = {}) {
    const contests = await fetchContests(false);

    // Every phase we care about tracking locally. Testing phases are
    // included so a cached BEFORE/CODING document is never left stranded —
    // it must be able to transition all the way to FINISHED.
    const trackedPhases = ["BEFORE", "CODING", "PENDING_SYSTEM_TEST", "SYSTEM_TEST", "FINISHED"];
    const relevant = contests.filter((c) => trackedPhases.includes(c.phase));

    const activeOrTesting = relevant.filter((c) => c.phase !== "FINISHED");

    // Reconciliation set: any contest we already have cached as non-finished
    // MUST be updated to whatever the API now reports, even if it has now
    // moved to FINISHED and would otherwise fall outside the display window
    // below. This is what prevents a stranded stale document.
    const existingNonFinishedIds = await ContestRepository.getNonFinishedContestIds("codeforces");
    const reconciledFinished = relevant.filter(
      (c) => c.phase === "FINISHED" && existingNonFinishedIds.has(c.id)
    );

    // Separate retention concern: how many *newly seen* finished contests to
    // persist for display purposes, independent of reconciliation above.
    const recentFinished = relevant
      .filter((c) => c.phase === "FINISHED")
      .sort((a, b) => b.startTimeSeconds - a.startTimeSeconds)
      .slice(0, 20);

    const finishedById = new Map(
      [...reconciledFinished, ...recentFinished].map((c) => [c.id, c])
    );

    const docs = [...activeOrTesting, ...finishedById.values()].map(normalizeContest);

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
