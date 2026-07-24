import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getMyActiveReminders } from "../services/contestService";

const ReminderContext = createContext(null);

const POLL_INTERVAL_MS = 30_000; // fast enough for the notifier's reminder window

/**
 * Single owner of "my active reminders" polling per browser tab. The bell
 * badge and the toast notifier both consume this instead of each running
 * their own interval — halves the redundant network/DB work per tab.
 */
export function ReminderProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [reminders, setReminders] = useState([]);

  // Manual refetch (exposed via context) is independent of any single
  // effect's cancellation scope, so it's safe for it to always write.
  const poll = useCallback(async () => {
    try {
      const { data } = await getMyActiveReminders();
      setReminders(data.data || []);
    } catch {
      // Silent — consumers just don't get an update this cycle.
    }
  }, []);

  useEffect(() => {
    // Scoped to THIS effect invocation only. Unlike a shared ref, this
    // cannot be reset by a later effect run — once cleanup sets it, any
    // still-in-flight response from THIS session is permanently ignored,
    // even if a new (e.g. unauthenticated) effect run has already started.
    let cancelled = false;

    if (!isAuthenticated) {
      setReminders([]);
      return;
    }

    const safePoll = async () => {
      try {
        const { data } = await getMyActiveReminders();
        if (!cancelled) setReminders(data.data || []);
      } catch {
        // Silent — consumers just don't get an update this cycle.
      }
    };

    safePoll();
    const id = setInterval(safePoll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated]);

  return (
    <ReminderContext.Provider value={{ reminders, refetch: poll }}>
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx) {
    throw new Error("useReminders must be used within a ReminderProvider");
  }
  return ctx;
}
