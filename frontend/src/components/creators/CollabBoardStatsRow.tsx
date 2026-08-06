import { AlertTriangle, LayoutGrid, ShieldCheck, UsersRound, PlayCircle } from "lucide-react";
import type { CollabBoardStats } from "../../lib/types";

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: typeof UsersRound;
  tone: "indigo" | "amber" | "green" | "coral";
  value: number;
  label: string;
}) {
  const toneClasses: Record<string, string> = {
    indigo: "bg-brand-100 text-brand-600",
    amber: "bg-[#fff5e5] text-[#ae7119]",
    green: "bg-[#eaf8ef] text-[#238b57]",
    coral: "bg-[#fff0ed] text-[#f06e62]",
  };
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-[#e7e5e4] bg-white p-3">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneClasses[tone]}`}>
        <Icon size={16} />
      </span>
      <div>
        <div className="text-[17px] font-bold leading-tight text-ink">{value}</div>
        <div className="text-[10px] text-muted">{label}</div>
      </div>
    </div>
  );
}

export function CollabBoardStatsRow({ stats }: { stats: CollabBoardStats }) {
  return (
    <div className="mb-4 grid grid-cols-[1fr_1fr_1fr_1fr_1.9fr] gap-2.5">
      <StatCard icon={UsersRound} tone="indigo" value={stats.unique_creators} label="Unique creators" />
      <StatCard icon={LayoutGrid} tone="amber" value={stats.active_collaborations} label="Active collaborations" />
      <StatCard icon={PlayCircle} tone="green" value={stats.videos_live} label="Videos live" />
      <StatCard icon={AlertTriangle} tone="coral" value={stats.dead_leads} label="Dead leads" />
      <div className="flex items-center gap-2.5 rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-brand-100 text-brand-600">
          <ShieldCheck size={16} />
        </span>
        <div>
          <div className="text-[13px] font-bold leading-tight text-ink">Username-based counting</div>
          <div className="mt-0.5 text-[10px] text-muted">
            Each Collab ID reaching Live adds one video to the linked creator username.
          </div>
        </div>
      </div>
    </div>
  );
}
