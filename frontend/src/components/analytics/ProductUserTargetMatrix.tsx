import { useState } from "react";
import type { AnalyticsMatrixCell, AnalyticsProductUserMatrix } from "../../lib/types";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

type ViewMode = "achieved" | "target" | "comparison";

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: "Achieved", value: "achieved" },
  { label: "Target", value: "target" },
  { label: "Target vs Achieved", value: "comparison" },
];

function formatCell(cell: AnalyticsMatrixCell, view: ViewMode): string {
  if (view === "achieved") return String(cell.achieved);
  if (view === "target") return String(cell.target);
  return `${cell.achieved} / ${cell.target}`;
}

export function ProductUserTargetMatrix({ matrix }: { matrix: AnalyticsProductUserMatrix }) {
  const [view, setView] = useState<ViewMode>("comparison");

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Product performance, user-wise</h3>
          <p className="text-xs text-muted">Monthly target vs live-video credit, per product and user.</p>
        </div>
        <div className="flex h-8 items-center gap-1 rounded-lg border border-[#e7e5e4] bg-white p-1">
          {VIEW_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setView(o.value)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${
                view === o.value ? "bg-brand-50 text-brand-600" : "text-gray-500 hover:bg-surface"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dashboard-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-surface text-left">
                <th className={`${TH} pl-4`}>Users</th>
                {matrix.users.map((u) => (
                  <th key={u.user_id} className={TH}>
                    {u.user_name}
                  </th>
                ))}
                <th className={`${TH} pr-4`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.product_id} className="border-t border-gray-100">
                  <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">{row.product_name}</td>
                  {row.cells.map((cell, idx) => (
                    <td key={matrix.users[idx].user_id} className="py-2.5 pr-3 text-[8px] text-[#55515c]">
                      {formatCell(cell, view)}
                    </td>
                  ))}
                  <td className="py-2.5 pr-4 text-[8px] font-extrabold text-ink">{formatCell(row.total, view)}</td>
                </tr>
              ))}
              {matrix.rows.length === 0 && (
                <tr>
                  <td colSpan={matrix.users.length + 2} className="py-6 text-center text-sm text-gray-400">
                    No product targets set for this scope.
                  </td>
                </tr>
              )}
              {matrix.rows.length > 0 && (
                <tr className="border-t border-[#e7e5e4] bg-surface">
                  <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">Total</td>
                  {matrix.column_totals.map((cell, idx) => (
                    <td key={matrix.users[idx].user_id} className="py-2.5 pr-3 text-[8px] font-extrabold text-ink">
                      {formatCell(cell, view)}
                    </td>
                  ))}
                  <td className="py-2.5 pr-4 text-[8px] font-extrabold text-ink">{formatCell(matrix.grand_total, view)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
