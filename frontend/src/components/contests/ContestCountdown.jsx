import { Radio } from "lucide-react";

/**
 * Renders a live "dd:hh:mm:ss" style countdown, or a running/testing/finished
 * label. `msUntilStart`, `isRunning`, and `isTesting` come from `useContests`
 * and are derived from the backend's authoritative `phase` field — this
 * component just formats them, it doesn't decide run state itself.
 */
export default function ContestCountdown({ msUntilStart, isRunning, isTesting, compact = false }) {
  if (isRunning) {
    return (
      <span
        className={`flex items-center gap-1.5 font-black text-red-600 uppercase tracking-widest animate-pulse ${
          compact ? "text-[10px]" : "text-sm"
        }`}
      >
        <Radio size={compact ? 11 : 14} strokeWidth={3} />
        Live Now
      </span>
    );
  }

  if (isTesting) {
    return (
      <span
        className={`font-black text-amber-600 uppercase tracking-widest ${
          compact ? "text-[10px]" : "text-sm"
        }`}
      >
        System Testing
      </span>
    );
  }

  // msUntilStart <= 0 with isRunning/isTesting both false means the contest
  // has actually finished, not that it's about to start.
  if (msUntilStart <= 0) {
    return (
      <span
        className={`font-black text-gray-400 uppercase tracking-widest ${
          compact ? "text-[10px]" : "text-sm"
        }`}
      >
        Ended
      </span>
    );
  }

  const totalSeconds = Math.floor(msUntilStart / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <span
      className={`font-black text-black tracking-widest tabular-nums ${
        compact ? "text-[11px]" : "text-sm sm:text-base"
      }`}
    >
      {days > 0 && `${days}d `}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}
