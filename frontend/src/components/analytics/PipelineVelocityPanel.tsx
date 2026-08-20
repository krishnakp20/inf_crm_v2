import { ArrowDown, ArrowUp } from "lucide-react";
import type { AnalyticsPipelineVelocityRow } from "../../lib/types";

export function PipelineVelocityPanel({ rows }: { rows: AnalyticsPipelineVelocityRow[] }) {
  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Pipeline velocity</h3>
      <p className="mb-2 text-xs text-muted">Average time between decisive creator stages. Lower is better.</p>
      <div className="dashboard-card divide-y divide-gray-100 p-0">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-ink">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink">{row.avg_days != null ? `${row.avg_days} days` : "—"}</span>
              {row.delta_days != null && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-bold ${
                    row.delta_days < 0 ? "text-emerald-600" : "text-[#cf4e43]"
                  }`}
                >
                  {row.delta_days < 0 ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                  {Math.abs(row.delta_days)}d
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
