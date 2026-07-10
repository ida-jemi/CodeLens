import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyActiveReminders } from "../../services/contestService";

const POLL_INTERVAL_MS = 60_000; // 1 minute — reminders don't need second-level freshness
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // badge counts contests starting in <24h

/**
 * Small navbar bell badge — shows how many reminders the user has set for
 * contests starting within the next 24 hours. Links through to the full
 * tracker page. Renders nothing while there's nothing to show.
 */
export default function ContestReminderBell() {
  const { isAuthenticated } = useAuth();
  const [dueSoonCount, setDueSoonCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await getMyActiveReminders();
        if (cancelled) return;
        const now = Date.now();
        const dueSoon = (data.data || []).filter(
          (c) => c.startTimeSeconds * 1000 - now < DUE_SOON_WINDOW_MS
        );
        setDueSoonCount(dueSoon.length);
      } catch {
        // Silent — the bell just won't update this cycle.
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <Link
      to="/contests/codeforces"
      title="Upcoming contest reminders"
      className="relative flex items-center justify-center w-8 h-8 text-zinc-500 hover:text-black transition-colors duration-150"
    >
      <Bell size={18} strokeWidth={2} />
      {dueSoonCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full leading-none">
          {dueSoonCount > 9 ? "9+" : dueSoonCount}
        </span>
      )}
    </Link>
  );
}
