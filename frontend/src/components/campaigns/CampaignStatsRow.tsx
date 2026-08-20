import { Layers, PlayCircle, Target, TrendingUp } from "lucide-react";
import type { CampaignStats } from "../../lib/types";

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
  subtext,
}: {
  icon: typeof Layers;
  tone: "indigo" | "amber" | "green" | "coral";
  value: string | number;
  label: string;
  subtext: string;
}) {
  const toneClasses: Record<string, string> = {
    indigo: "bg-brand-100 text-brand-600",
    amber: "bg-[#fff5e5] text-[#ae7119]",
    green: "bg-[#eaf8ef] text-[#238b57]",
    coral: "bg-[#fff0ed] text-[#f06e62]",
  };
  return (
    <div className="rounded-card border border-[#e7e5e4] bg-white p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneClasses[tone]}`}>
          <Icon size={16} />
        </span>
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-bold leading-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{subtext}</div>
    </div>
  );
}

export function CampaignStatsRow({ stats }: { stats: CampaignStats }) {
  return (
    <div className="mb-4 grid grid-cols-4 gap-3">
      <StatCard
        icon={Layers}
        tone="indigo"
        value={stats.total_campaigns}
        label="Total campaigns"
        subtext={`${stats.currently_live} currently Live`}
      />
      <StatCard
        icon={PlayCircle}
        tone="green"
        value={stats.live_ads}
        label="Live ads"
        subtext="From creator cards moved to Live"
      />
      <StatCard
        icon={Target}
        tone="amber"
        value={stats.target_ads}
        label="Target ads"
        subtext="Across filtered campaigns"
      />
      <StatCard
        icon={TrendingUp}
        tone="coral"
        value={`${stats.target_completion_pct}%`}
        label="Target completion"
        subtext="Live vs target across scope"
      />
    </div>
  );
}
