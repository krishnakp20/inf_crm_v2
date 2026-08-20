import { Clock, PlayCircle, ShieldCheck, Video } from "lucide-react";
import type { PartnershipStats } from "../../lib/types";

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
  subtext,
}: {
  icon: typeof Video;
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

export function PartnershipStatsRow({ stats }: { stats: PartnershipStats }) {
  return (
    <div className="mb-4 grid grid-cols-4 gap-3">
      <StatCard
        icon={Video}
        tone="indigo"
        value={stats.video_register}
        label="Video register"
        subtext="Videos always remain in Overview"
      />
      <StatCard
        icon={PlayCircle}
        tone="green"
        value={stats.open_tickets}
        label="Open tickets"
        subtext="Compact shared exchanges"
      />
      <StatCard
        icon={Clock}
        tone="amber"
        value={stats.awaiting_my_action}
        label="Awaiting my action"
        subtext="Sorted with visible aging"
      />
      <StatCard
        icon={ShieldCheck}
        tone="coral"
        value={stats.closed_and_live}
        label="Closed & live"
        subtext="Verified codes and locked commercials"
      />
    </div>
  );
}
