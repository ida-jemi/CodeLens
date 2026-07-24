import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
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
  const cancelledRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const { data } = await getMyActiveReminders();
      if (cancelledRef.current) return;
      setReminders(data.data || []);
    } catch {
      // Silent — consumers just don't get an update this cycle.
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    if (!isAuthenticated) {
      setReminders([]);
      return;
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [isAuthenticated, poll]);

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
