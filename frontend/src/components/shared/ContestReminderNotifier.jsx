import { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useReminders } from "../../context/ReminderContext";
import { markReminderNotified } from "../../services/contestService";
import { createReminderChannel } from "../../utils/reminderBroadcast";

const REMINDER_WINDOW_MS = 15 * 60 * 1000; // toast fires when a contest starts within 15 minutes

/**
 * Mounted once in MainLayout. Reads reminders from the shared
 * ReminderProvider (see ReminderContext.jsx) — no polling of its own — and
 * pops an in-app toast when a reminder-contest is starting within
 * REMINDER_WINDOW_MS. Coordinates with other open tabs via BroadcastChannel
 * so simultaneous tabs don't both show the same toast. Each reminder only
 * ever toasts once — the backend persists `notifiedAt` so this survives
 * page reloads/navigation, and BroadcastChannel handles the same-instant
 * multi-tab case that a reload wouldn't catch.
 */
export default function ContestReminderNotifier() {
  const { isAuthenticated } = useAuth();
  const { reminders } = useReminders();
  const [toast, setToast] = useState(null);
  const shownThisSession = useRef(new Set());
  const channelRef = useRef(null);

  useEffect(() => {
    channelRef.current = createReminderChannel();
    const unsubscribe = channelRef.current.onClaim((contestId) => {
      // Another tab already claimed this reminder — suppress it here too.
      shownThisSession.current.add(contestId);
      setToast((current) => (current?.contestId === contestId ? null : current));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !reminders.length) return;

    const now = Date.now();
    const due = reminders.find((c) => {
      if (c.notifiedAt) return false;
      if (shownThisSession.current.has(c.contestId)) return false;
      const msUntilStart = c.startTimeSeconds * 1000 - now;
      return msUntilStart > 0 && msUntilStart <= REMINDER_WINDOW_MS;
    });

    if (due) {
      shownThisSession.current.add(due.contestId);
      channelRef.current?.postClaim(due.contestId);
      const minutesLeft = Math.max(1, Math.round((due.startTimeSeconds * 1000 - now) / 60000));
      setToast({ ...due, minutesLeft });
      markReminderNotified(due.contestId).catch(() => {});
    }
  }, [isAuthenticated, reminders]);

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
