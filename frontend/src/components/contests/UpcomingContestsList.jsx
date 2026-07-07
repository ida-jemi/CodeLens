import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useContests } from "../../hooks/useContests";
import ContestCountdown from "./ContestCountdown";

const DIVISIONS = ["all", "Div. 1", "Div. 2", "Div. 3", "Div. 4", "Educational", "Global"];

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
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.round((durationSeconds % 3600) / 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

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

      {visibleContests.length === 0 ? (
        <div className="border-4 border-black bg-white p-6 text-center">
          <p className="font-black uppercase tracking-widest text-sm text-gray-500">
            No upcoming Codeforces contests scheduled for this division.
          </p>
        </div>
      ) : (

        <div className={compact ? "flex flex-col gap-3" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>
          {visibleContests.map((contest) => (
            <div
              key={contest.contestId}
              className={`border-4 border-black bg-white ${compact ? "p-4" : "p-6"
                } hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-all`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="border-2 border-blue-600 bg-blue-50 text-blue-800 px-3 py-1 text-xs font-black uppercase tracking-wide shrink-0">
                  {contest.division}
                </div>
                <ContestCountdown
                  msUntilStart={contest.msUntilStart}
                  isRunning={contest.isRunning}
                />
              </div>

              <h3
                className={`font-black uppercase tracking-tight text-black mb-3 ${compact ? "text-base" : "text-xl"
                  }`}
              >
                {contest.name}
              </h3>

              <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-600 mb-4">
                <span>{formatStartTime(contest.startTimeSeconds)}</span>
                <span>{formatDuration(contest.durationSeconds)}</span>
              </div>

              <button
                onClick={() => handleReminderClick(contest.contestId)}
                className={`w-full px-4 py-3 border-4 border-black font-black uppercase tracking-widest text-sm transition-colors ${contest.hasReminder
                  ? "bg-black text-white hover:bg-gray-800"
                  : "bg-white text-black hover:bg-blue-600 hover:text-white hover:border-blue-600"
                  }`}
              >
                {contest.hasReminder ? "🔔 Reminder Set" : "🔕 Remind Me"}
              </button>
            </div>
          ))}
        </div>
      )}

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
