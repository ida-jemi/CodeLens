import { CalendarClock } from "lucide-react";
import UpcomingContestsList from "../contests/UpcomingContestsList";

/**
 * Dashboard-sized preview of the Codeforces contest tracker — top 3 upcoming
 * contests with a link through to the full /contests/codeforces page.
 */
export default function UpcomingContestsWidget() {
  return (
    <div className="w-full border-4 border-black p-6 sm:p-8 bg-white shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
      <div className="flex items-center gap-3 mb-6 border-b-4 border-black pb-4">
        <CalendarClock size={26} strokeWidth={2.5} className="text-black shrink-0" />
        <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-black">
          Upcoming Contests
        </h3>
      </div>
      <UpcomingContestsList compact limit={3} />
    </div>
  );
}
