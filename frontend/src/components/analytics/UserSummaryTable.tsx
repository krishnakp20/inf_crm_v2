import { formatCurrency } from "../../lib/format";
import type { AnalyticsUserBreakdownRow } from "../../lib/types";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";
const TD = "py-2.5 pr-3 text-[8px] text-[#55515c]";

export function UserSummaryTable({ rows }: { rows: AnalyticsUserBreakdownRow[] }) {
  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Summary</h3>
      <p className="mb-2 text-xs text-muted">Key numbers per user, for the selected scope and date range.</p>
      <div className="dashboard-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-surface text-left">
                <th className={`${TH} pl-4`}>Particulars</th>
                <th className={TH}>New Lead</th>
                <th className={TH}>Locked</th>
                <th className={TH}>Average creator Cost</th>
                <th className={TH}>Content Live</th>
                <th className={TH}>Ads Live</th>
                <th className={TH}>Hit Rate</th>
                <th className={TH}>Cost per comment</th>
                <th className={TH}>Google ROAS</th>
                <th className={TH}>Meta ROAS</th>
                <th className={`${TH} pr-4`}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id} className="border-t border-gray-100">
                  <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">{row.user_name}</td>
                  <td className={TD}>{row.new_lead}</td>
                  <td className={TD}>{row.locked}</td>
                  <td className={TD}>{formatCurrency(row.avg_creator_cost)}</td>
                  <td className={TD}>{row.live}</td>
                  <td className={TD}>{row.ads_live}</td>
                  <td className={TD}>{row.hit_rate_pct}%</td>
                  <td className={TD}>{formatCurrency(row.cost_per_comment)}</td>
                  <td className={TD}>{row.google_roas ?? "—"}</td>
                  <td className={TD}>{row.meta_roas ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-[8px] font-semibold text-[#55515c]">{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-sm text-gray-400">
                    No users in scope for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
