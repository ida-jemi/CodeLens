import UpcomingContestsList from "../contests/UpcomingContestsList";

export default function UpcomingContestsWidget() {
  return (
    <div className="border-4 border-black p-6 sm:p-8 bg-white shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
      <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-black mb-6 border-b-4 border-black pb-4">
        Upcoming Contests
      </h3>
      <UpcomingContestsList compact limit={3} />
    </div>
  );
}
