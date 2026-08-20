export function AnalyticsSummaryStrip({
  scopeLabel,
  dateRangeLabel,
  liveVideoCount,
}: {
  scopeLabel: string;
  dateRangeLabel: string;
  liveVideoCount: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-card border border-[#e7e5e4] bg-surface px-4 py-2.5 text-xs">
      <div>
        <span className="font-bold text-ink">VIEWING</span> <span className="text-gray-500">{scopeLabel}</span>
      </div>
      <div className="h-3 w-px bg-[#e7e5e4]" />
      <div>
        <span className="font-bold text-ink">DATE RANGE</span> <span className="text-gray-500">{dateRangeLabel}</span>
      </div>
      <div className="h-3 w-px bg-[#e7e5e4]" />
      <div>
        <span className="font-bold text-ink">DATA INCLUDED</span>{" "}
        <span className="text-gray-500">{liveVideoCount} Live videos</span>
      </div>
      <div className="ml-auto text-gray-400">Hit definition: a video with 500+ comments</div>
    </div>
  );
}
