import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getUpcomingCodeforcesContests,
  getMyReminderIds,
  addContestReminder,
  removeContestReminder,
} from "../services/contestService";

export const useContests = () => {
  const { isAuthenticated } = useAuth();

  const [contests, setContests] = useState([]);
  const [reminderIds, setReminderIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const fetchContests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getUpcomingCodeforcesContests();
      setContests(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load upcoming contests.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReminders = useCallback(async () => {
    if (!isAuthenticated) {
      setReminderIds([]);
      return;
    }
    try {
      const { data } = await getMyReminderIds();
      setReminderIds(data.data || []);
    } catch {
      // Non-fatal
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchContests();
  }, [fetchContests]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleReminder = async (contestId) => {
    const hasReminder = reminderIds.includes(contestId);
    setReminderIds((prev) =>
      hasReminder ? prev.filter((id) => id !== contestId) : [...prev, contestId]
    );
    try {
      if (hasReminder) {
        await removeContestReminder(contestId);
      } else {
        await addContestReminder(contestId);
      }
    } catch (err) {
      setReminderIds((prev) =>
        hasReminder ? [...prev, contestId] : prev.filter((id) => id !== contestId)
      );
      throw err;
    }
  };

  const contestsWithMeta = useMemo(() => {
    return contests.map((contest) => {
      const startMs = contest.startTimeSeconds * 1000;
      const isTesting = ["PENDING_SYSTEM_TEST", "SYSTEM_TEST"].includes(contest.phase);
      return {
        ...contest,
        hasReminder: reminderIds.includes(contest.contestId),
        isRunning: contest.phase === "CODING" && now >= startMs,
        isTesting,
        msUntilStart: startMs - now,
      };
    });
  }, [contests, reminderIds, now]);

  return {
    contests: contestsWithMeta,
    loading,
    error,
    now,
    toggleReminder,
    refetch: fetchContests,
  };
};
