import { formatCurrency } from "../../lib/format";
import type { AnalyticsCostEfficiency } from "../../lib/types";

export function CostEfficiencyPanel({ data }: { data: AnalyticsCostEfficiency }) {
  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Cost efficiency</h3>
      <p className="mb-2 text-xs text-muted">Commercial efficiency for the current scope.</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Average creator cost</div>
          <div className="mt-1 text-xl font-bold text-ink">{formatCurrency(data.avg_creator_cost)}</div>
          <div className="mt-0.5 text-[11px] text-muted">Total creator cost ÷ Live videos</div>
        </div>
        <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Total creator cost</div>
          <div className="mt-1 text-xl font-bold text-ink">{formatCurrency(data.total_creator_cost)}</div>
          <div className="mt-0.5 text-[11px] text-muted">Commercial locked on Live records</div>
        </div>
        <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Cost per hit</div>
          <div className="mt-1 text-xl font-bold text-ink">{formatCurrency(data.cost_per_hit)}</div>
          <div className="mt-0.5 text-[11px] text-muted">Total creator cost ÷ 500+ comment videos</div>
        </div>
      </div>
    </div>
  );
}
