import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bell, BellOff, Calendar, Timer } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useContests } from "../../hooks/useContests";
import ContestCountdown from "./ContestCountdown";

const DIVISIONS = [
  "all",
  "Div. 1",
  "Div. 2",
  "Div. 1 + 2",
  "Div. 3",
  "Div. 4",
  "Educational",
  "Global",
  "Kotlin Heroes",
  "ICPC",
  "Other",
];

function formatStartTime(startTimeSeconds) {
  return new Date(startTimeSeconds * 1000).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(durationSeconds) {
  const totalMinutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * @param {boolean} compact   - Dashboard-widget mode: top N contests, no filters.
 * @param {number}  limit     - Max contests to show in compact mode.
 */
export default function UpcomingContestsList({ compact = false, limit = 3 }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { contests, loading, error, toggleReminder } = useContests();
  const [division, setDivision] = useState("all");
  const [reminderError, setReminderError] = useState(null);

  const visibleContests = useMemo(() => {
    const filtered =
      division === "all" ? contests : contests.filter((c) => c.division === division);
    return compact ? filtered.slice(0, limit) : filtered;
  }, [contests, division, compact, limit]);

  const handleReminderClick = async (contestId) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    setReminderError(null);
    try {
      await toggleReminder(contestId);
    } catch {
      setReminderError("Couldn't update reminder. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-[4px] border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-4 border-black bg-white p-6 text-center">
        <p className="font-black uppercase tracking-widest text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!visibleContests.length) {
    return (
      <div className="border-4 border-black bg-white p-6 text-center">
        <p className="font-black uppercase tracking-widest text-sm text-gray-500">
          No upcoming Codeforces contests scheduled right now.
        </p>
      </div>
    );
  }

  return (
    <div>
      {!compact && (
        <div className="flex flex-wrap gap-3 mb-8">
          {DIVISIONS.map((div) => (
            <button
              key={div}
              onClick={() => setDivision(div)}
              className={`px-6 py-3 border-4 border-black font-black text-sm uppercase tracking-widest transition-all ${
                division === div
                  ? "bg-blue-600 text-white"
                  : "bg-white text-black hover:bg-blue-600 hover:text-white"
              }`}
            >
              {div}
            </button>
          ))}
        </div>
      )}

      {reminderError && (
        <p className="font-black uppercase tracking-widest text-xs text-red-600 mb-4">
          {reminderError}
        </p>
      )}

      <div
        className={
          compact
            ? "grid grid-cols-1 sm:grid-cols-3 gap-4"
            : "grid grid-cols-1 lg:grid-cols-2 gap-6"
        }
      >
        {visibleContests.map((contest) => (
          <div
            key={contest.contestId}
            className={`flex flex-col border-4 border-black bg-white ${
              compact ? "p-4" : "p-6"
            } hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-all`}
          >
            <div
              className={`flex items-start justify-between gap-2 ${
                compact ? "mb-2" : "mb-3"
              }`}
            >
              <div
                className={`border-2 border-blue-600 bg-blue-50 text-blue-800 font-black uppercase tracking-wide shrink-0 ${
                  compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
                }`}
              >
                {contest.division}
              </div>
              <ContestCountdown
                msUntilStart={contest.msUntilStart}
                isRunning={contest.isRunning}
                isTesting={contest.isTesting}
                compact={compact}
              />
            </div>

            <h3
              className={`font-black uppercase tracking-tight text-black ${
                compact ? "text-sm mb-2 line-clamp-2 min-h-[2.5em]" : "text-xl mb-3"
              }`}
            >
              {contest.name}
            </h3>

            <div
              className={
                compact
                  ? "flex flex-col gap-1 font-bold uppercase tracking-wide text-gray-600 text-[10px] mb-3"
                  : "flex flex-row flex-wrap justify-between items-center gap-2 font-bold uppercase tracking-wide text-gray-600 text-xs mb-4"
              }
            >
              <span className="flex items-center gap-1">
                <Calendar size={compact ? 11 : 13} strokeWidth={2.5} />
                {formatStartTime(contest.startTimeSeconds)}
              </span>
              <span className="flex items-center gap-1">
                <Timer size={compact ? 11 : 13} strokeWidth={2.5} />
                {formatDuration(contest.durationSeconds)}
              </span>
            </div>

            <button
              onClick={() => handleReminderClick(contest.contestId)}
              className={`mt-auto w-full flex items-center justify-center gap-2 border-4 border-black font-black uppercase tracking-widest transition-colors ${
                compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
              } ${
                contest.hasReminder
                  ? "bg-black text-white hover:bg-gray-800"
                  : "bg-white text-black hover:bg-blue-600 hover:text-white hover:border-blue-600"
              }`}
            >
              {contest.hasReminder ? (
                <>
                  <Bell size={compact ? 14 : 16} strokeWidth={2.5} />
                  {compact ? "Set" : "Reminder Set"}
                </>
              ) : (
                <>
                  <BellOff size={compact ? 14 : 16} strokeWidth={2.5} />
                  Remind Me
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {compact && (
        <Link
          to="/contests/codeforces"
          className="block mt-4 text-center text-xs font-black uppercase tracking-widest text-blue-600 hover:text-black transition-colors"
        >
          View All Upcoming Contests →
        </Link>
      )}
    </div>
  );
}
