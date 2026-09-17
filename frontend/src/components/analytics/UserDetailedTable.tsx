import { formatCurrency } from "../../lib/format";
import type { AnalyticsUserBreakdownRow } from "../../lib/types";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";
const TD = "py-2.5 pr-3 text-[8px] text-[#55515c]";

function sum(rows: AnalyticsUserBreakdownRow[], key: keyof AnalyticsUserBreakdownRow): number {
  return rows.reduce((total, row) => total + (typeof row[key] === "number" ? (row[key] as number) : 0), 0);
}

export function UserDetailedTable({
  rows,
  totalAvgCreatorCost,
  totalHitRatePct,
}: {
  rows: AnalyticsUserBreakdownRow[];
  /** Scope-wide equivalents for the Total row's ratio columns -- summing
   * each user's own average would misrepresent the real overall figure,
   * so these are the same numbers already shown in Cost efficiency /
   * Performance overview above, not re-derived from the per-user rows. */
  totalAvgCreatorCost: number | null;
  totalHitRatePct: number;
}) {
  const revenueTotal = sum(rows, "revenue");
  const anyRevenue = rows.some((r) => r.revenue != null);

  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Detailed view</h3>
      <p className="mb-2 text-xs text-muted">Full pipeline breakdown per user -- each lead counted once, in its current stage.</p>
      <div className="dashboard-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-surface text-left">
                <th className={`${TH} pl-4`}>Users</th>
                <th className={TH}>New Lead</th>
                <th className={TH}>Replied</th>
                <th className={TH}>Negotiation</th>
                <th className={TH}>Locked</th>
                <th className={TH}>Product Sent</th>
                <th className={TH}>Product delivered</th>
                <th className={TH}>First Draft</th>
                <th className={TH}>Approved</th>
                <th className={TH}>Live</th>
                <th className={TH}>Dead Lead</th>
                <th className={TH}>Revenue</th>
                <th className={TH}>AVG Creator Cost</th>
                <th className={TH}>META ROAS</th>
                <th className={TH}>GOOGLE ROAS</th>
                <th className={TH}>Hit Rate</th>
                <th className={`${TH} pr-4`}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id} className="border-t border-gray-100">
                  <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">{row.user_name}</td>
                  <td className={TD}>{row.new_lead}</td>
                  <td className={TD}>{row.replied}</td>
                  <td className={TD}>{row.negotiating}</td>
                  <td className={TD}>{row.locked}</td>
                  <td className={TD}>{row.product_sent}</td>
                  <td className={TD}>{row.product_delivered}</td>
                  <td className={TD}>{row.first_draft}</td>
                  <td className={TD}>{row.approved}</td>
                  <td className={TD}>{row.live}</td>
                  <td className={TD}>{row.dead_lead}</td>
                  <td className={TD}>{formatCurrency(row.revenue)}</td>
                  <td className={TD}>{formatCurrency(row.avg_creator_cost)}</td>
                  <td className={TD}>{row.meta_roas ?? "—"}</td>
                  <td className={TD}>{row.google_roas ?? "—"}</td>
                  <td className={TD}>{row.hit_rate_pct}%</td>
                  <td className="py-2.5 pr-4 text-[8px] font-extrabold text-ink">{row.total}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={16} className="py-6 text-center text-sm text-gray-400">
                    No users in scope for this range.
                  </td>
                </tr>
              )}
              {rows.length > 0 && (
                <tr className="border-t border-[#e7e5e4] bg-surface">
                  <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">Total</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "new_lead")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "replied")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "negotiating")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "locked")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "product_sent")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "product_delivered")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "first_draft")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "approved")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "live")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{sum(rows, "dead_lead")}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{anyRevenue ? formatCurrency(revenueTotal) : "—"}</td>
                  <td className={`${TD} font-extrabold text-ink`}>{formatCurrency(totalAvgCreatorCost)}</td>
                  <td className={TD}>—</td>
                  <td className={TD}>—</td>
                  <td className={`${TD} font-extrabold text-ink`}>{totalHitRatePct}%</td>
                  <td className="py-2.5 pr-4 text-[8px] font-extrabold text-ink">{sum(rows, "total")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
