import { formatCurrency } from "../../lib/format";
import type { AnalyticsCommercialLocked } from "../../lib/types";

export function CommercialLockedPanel({ data }: { data: AnalyticsCommercialLocked }) {
  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Commercial locked</h3>
      <p className="mb-2 text-xs text-muted">Total budget committed in this period, split by Budget Used vs Budget Left.</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Total Budget Committed</div>
          <div className="mt-1 text-xl font-bold text-ink">{formatCurrency(data.total_locked)}</div>
          <div className="mt-0.5 text-[12px] text-muted">Every collaboration locked in this period</div>
        </div>
        <div className="rounded-card border border-emerald-100 bg-emerald-50 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Budget Used</div>
          <div className="mt-1 text-xl font-bold text-ink">{formatCurrency(data.achieved)}</div>
          <div className="mt-0.5 text-[12px] text-muted">Locked commercial on videos now Live</div>
        </div>
        <div className="rounded-card border border-amber-100 bg-amber-50 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Budget Left</div>
          <div className="mt-1 text-xl font-bold text-ink">{formatCurrency(data.committed)}</div>
          <div className="mt-0.5 text-[12px] text-muted">Locked commercial still in the pipeline, not yet Live</div>
        </div>
      </div>
    </div>
  );
}
