import { Eye, IndianRupee, MessageSquare, PlayCircle, TrendingUp } from "lucide-react";
import { compactNumber, formatCurrency } from "../../lib/format";
import type { AnalyticsPerformanceOverview } from "../../lib/types";

function Tile({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: typeof PlayCircle;
  label: string;
  value: string | number;
  subtext: string;
}) {
  return (
    <div className="rounded-card border border-[#e7e5e4] bg-white p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-600">
          <Icon size={16} />
        </span>
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-bold leading-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{subtext}</div>
    </div>
  );
}

export function PerformanceOverviewRow({
  data,
  showCpv,
}: {
  data: AnalyticsPerformanceOverview;
  showCpv: boolean;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Performance overview</h3>
      <p className="mb-2 text-xs text-muted">The numbers to check first.</p>
      <div className={`grid gap-3 ${showCpv ? "grid-cols-5" : "grid-cols-3"}`}>
        <Tile icon={PlayCircle} label="Live videos" value={data.live_videos} subtext="Source: My Creators Live" />
        <Tile icon={Eye} label="Total views" value={compactNumber(data.total_views)} subtext="Across the selected scope" />
        {showCpv && (
          <Tile
            icon={IndianRupee}
            label="CPV"
            value={data.cpv != null ? formatCurrency(data.cpv) : "—"}
            subtext="Creator cost ÷ views"
          />
        )}
        <Tile
          icon={TrendingUp}
          label="Hit rate"
          value={`${data.hit_rate_pct}%`}
          subtext={`${data.hits} of ${data.total_live_videos_for_hit_rate} videos hit`}
        />
        {showCpv && (
          <Tile
            icon={MessageSquare}
            label="Cost per comment"
            value={data.cost_per_comment != null ? formatCurrency(data.cost_per_comment) : "—"}
            subtext={`${compactNumber(data.total_comments)} total comments`}
          />
        )}
      </div>
    </div>
  );
}
