import { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyActiveReminders, markReminderNotified } from "../../services/contestService";

const POLL_INTERVAL_MS = 30_000; // 30s — frequent enough to catch the reminder window
const REMINDER_WINDOW_MS = 15 * 60 * 1000; // toast fires when a contest starts within 15 minutes

/**
 * Mounted once in MainLayout. While the user is active on the platform and
 * signed in, polls their contest reminders and pops an in-app toast when a
 * reminder-contest is starting within REMINDER_WINDOW_MS. Each reminder only
 * ever toasts once — the backend persists `notifiedAt` so this survives
 * page reloads/navigation.
 */
export default function ContestReminderNotifier() {
  const { isAuthenticated } = useAuth();
  const [toast, setToast] = useState(null);
  const shownThisSession = useRef(new Set());

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await getMyActiveReminders();
        if (cancelled) return;

        const now = Date.now();
        const due = (data.data || []).find((c) => {
          if (c.notifiedAt) return false;
          if (shownThisSession.current.has(c.contestId)) return false;
          const msUntilStart = c.startTimeSeconds * 1000 - now;
          return msUntilStart > 0 && msUntilStart <= REMINDER_WINDOW_MS;
        });

        if (due) {
          shownThisSession.current.add(due.contestId);
          const minutesLeft = Math.max(
            1,
            Math.round((due.startTimeSeconds * 1000 - now) / 60000)
          );
          setToast({ ...due, minutesLeft });
          markReminderNotified(due.contestId).catch(() => {});
        }
      } catch {
        // Silent — non-critical background polling.
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated]);

  if (!toast) return null;

  const { minutesLeft } = toast;

  return (
    <div className="fixed bottom-6 right-6 z-[100] max-w-sm border-4 border-black bg-black text-white p-5 shadow-[8px_8px_0_0_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-blue-400 mb-1">
            <Bell size={13} strokeWidth={2.5} />
            Contest Starting Soon
          </p>
          <p className="font-black uppercase tracking-tight text-sm mb-1">{toast.name}</p>
          <p className="text-xs font-bold text-gray-300">
            Starts in ~{minutesLeft} minute{minutesLeft === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => setToast(null)}
          aria-label="Dismiss"
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
