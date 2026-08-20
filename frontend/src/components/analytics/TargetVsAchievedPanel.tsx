import { initials } from "../../lib/format";
import type { AnalyticsTargetRow } from "../../lib/types";

export function TargetVsAchievedPanel({ rows }: { rows: AnalyticsTargetRow[] }) {
  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Target vs achieved</h3>
      <p className="mb-2 text-xs text-muted">Live-video credit against each user's target.</p>
      <div className="dashboard-card flex flex-col gap-3 p-4">
        {rows.map((row) => (
          <div key={row.user_id} className="flex items-center gap-3">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[9px] font-extrabold text-brand-600">
              {initials(row.user_name)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">{row.user_name}</span>
                <span className="text-gray-500">
                  {row.credit} / {row.target} videos · {row.pct}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.min(row.pct, 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-gray-400">No targets set for this scope.</p>}
      </div>
    </div>
  );
}
