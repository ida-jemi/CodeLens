import cron from "node-cron";
import ContestService from "../modules/contests/service.js";

export const startContestSyncJob = () => {
  const runSync = async () => {
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
