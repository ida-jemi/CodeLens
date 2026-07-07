export default function ContestCountdown({ msUntilStart, isRunning }) {
  if (isRunning) {
    return (
      <span className="font-black text-red-600 uppercase tracking-widest text-sm animate-pulse">
        ● Live Now
      </span>
    );
  }

  if (msUntilStart <= 0) {
    return (
      <span className="font-black text-gray-400 uppercase tracking-widest text-sm">
        Starting…
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
    <span className="font-black text-black tracking-widest text-sm sm:text-base tabular-nums">
      {days > 0 && `${days}d `}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}
