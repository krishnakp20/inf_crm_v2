import { IndianRupee, ShieldCheck, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import type { AnalyticsBusinessImpact } from "../../lib/types";

function ImpactCard({
  icon: Icon,
  label,
  value,
  subtext,
  placeholder,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string | number;
  subtext: string;
  placeholder?: boolean;
}) {
  return (
    <div className="rounded-card border border-[#e7e5e4] bg-white p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-600">
          <Icon size={16} />
        </span>
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      </div>
      <div className={`mt-2 text-2xl font-bold leading-tight ${placeholder ? "text-gray-400" : "text-ink"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{subtext}</div>
    </div>
  );
}

export function BusinessImpactRow({
  data,
  showRevenue,
}: {
  data: AnalyticsBusinessImpact;
  showRevenue: boolean;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Business impact</h3>
      <p className="mb-2 text-xs text-muted">
        {showRevenue
          ? "Revenue, return and ads activation for the selected user scope."
          : "Ads activation for the selected user scope. Financial performance is Admin-only."}
      </p>
      <div className={`grid gap-3 ${showRevenue ? "grid-cols-3" : "grid-cols-1"}`}>
        {showRevenue && (
          <>
            <ImpactCard
              icon={IndianRupee}
              label="Revenue"
              value={data.revenue != null ? formatCurrency(data.revenue) : "Phase 2"}
              subtext={data.revenue != null ? "Uploaded by POC code in Settings" : "Connection will be added next phase"}
              placeholder={data.revenue == null}
            />
            <ImpactCard
              icon={TrendingUp}
              label="ROAS"
              value={data.roas != null ? `${data.roas}x` : "Phase 2"}
              subtext={data.roas != null ? "Revenue ÷ uploaded ad spend" : "Connection will be added next phase"}
              placeholder={data.roas == null}
            />
          </>
        )}
        <ImpactCard icon={ShieldCheck} label="Ads live" value={data.ads_live} subtext="Closed & Live in Partnership Hub" />
      </div>
    </div>
  );
}
