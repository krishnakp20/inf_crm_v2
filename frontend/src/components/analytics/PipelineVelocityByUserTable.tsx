import type { AnalyticsVelocityByUserRow } from "../../lib/types";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

function formatDays(avgDays: number | null): string {
  return avgDays != null ? `${avgDays}d` : "—";
}

export function PipelineVelocityByUserTable({ rows }: { rows: AnalyticsVelocityByUserRow[] }) {
  const labels = rows[0]?.cells.map((c) => c.label) ?? [];

  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Pipeline velocity by user</h3>
      <p className="mb-2 text-xs text-muted">Average time between decisive creator stages, per user. Lower is better.</p>
      <div className="dashboard-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-surface text-left">
                <th className={`${TH} pl-4`}>Users</th>
                {labels.map((label) => (
                  <th key={label} className={TH}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id} className="border-t border-gray-100">
                  <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">{row.user_name}</td>
                  {row.cells.map((cell) => (
                    <td key={cell.label} className="py-2.5 pr-3 text-[8px] text-[#55515c]">
                      {formatDays(cell.avg_days)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={labels.length + 1} className="py-6 text-center text-sm text-gray-400">
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
