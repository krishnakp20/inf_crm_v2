import { List } from "lucide-react";
import type { FunnelStage } from "../../lib/types";

const STAGE_COLORS = ["#5B5CE2", "#696AE8", "#797AEF", "#8B8BF2", "#A1A0F5", "#AEADF6", "#BCBAF8", "#CAC9FA"];

export function PipelineFunnel({
  funnel,
  movedThisWeek,
  onReset,
}: {
  funnel: FunnelStage[];
  movedThisWeek: number;
  onReset?: () => void;
}) {
  const maxCount = Math.max(...funnel.map((s) => s.count), 1);

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-normal text-ink">Lead pipeline</h2>
          <p className="mt-1 text-[10px] text-muted">A clear stage-by-stage view of creator movement</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-[#e7e5e4] px-2.5 py-1 text-[9px] font-semibold text-ink hover:bg-surface">
            <List size={13} />
            All stages
          </button>
          <button
            onClick={onReset}
            className="text-[9px] font-bold text-brand-600 hover:text-brand-700"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-8 gap-1">
        {funnel.map((stage, i) => {
          const color = STAGE_COLORS[i % STAGE_COLORS.length];
          const barWidth = Math.max(Math.sqrt(stage.count / maxCount) * 100, stage.count > 0 ? 6 : 0);
          return (
            <button key={stage.stage} className="flex flex-col items-start pr-2 text-left">
              <div className="mb-1.5 flex items-center gap-1 self-stretch">
                <span
                  className="grid h-[25px] w-[25px] shrink-0 place-items-center rounded-full text-[7px] font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {i + 1}
                </span>
                {i < funnel.length - 1 && <span className="h-[2px] flex-1 bg-[#edecf0]" />}
              </div>
              <div className="text-[8px] font-extrabold text-muted">{stage.label}</div>
              <div className="mt-1.5 text-[21px] font-bold tracking-tight text-ink">{stage.count}</div>
              <div className="mt-1 text-[6px] text-[#99949e]">
                {i === 0 ? "Starting stage" : `${stage.conversion_pct ?? 0}% from previous`}
              </div>
              <div className="mt-1.5 h-[5px] w-full rounded-full bg-[#edecf0]">
                <div className="h-[5px] rounded-full" style={{ width: `${barWidth}%`, backgroundColor: color }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#e7e5e4] pt-3 text-[11px]">
        <div className="flex items-center gap-1.5 text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <strong className="font-semibold text-ink">{movedThisWeek} creators moved forward this week</strong>
        </div>
        <span className="text-[10px] text-gray-400">Click any stage to focus the view</span>
      </div>
    </div>
  );
}
