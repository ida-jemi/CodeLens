import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useReminders } from "../../context/ReminderContext";

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // badge counts contests starting in <24h

/**
 * Small navbar bell badge — shows how many reminders the user has set for
 * contests starting within the next 24 hours. Links through to the full
 * tracker page. Data comes from the shared ReminderProvider (see
 * ReminderContext.jsx) rather than its own polling loop.
 */
export default function ContestReminderBell() {
  const { isAuthenticated } = useAuth();
  const { reminders } = useReminders();

  if (!isAuthenticated) return null;

  const now = Date.now();
  const dueSoonCount = reminders.filter(
    (c) => c.startTimeSeconds * 1000 - now < DUE_SOON_WINDOW_MS
  ).length;

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
