import { useMemo, useState } from "react";
import { useSort } from "../../hooks/useSort";
import { initials } from "../../lib/format";
import { SortableHeader } from "../shared/SortableHeader";
import type { TargetRow } from "../../lib/types";

const ROW_COLORS = ["#5B5CE2", "#F06E62", "#238B57", "#E6A23C"];

function getValue(row: TargetRow, field: string): unknown {
  switch (field) {
    case "name":
      return row.name;
    case "weekly_pct":
      return row.weekly_pct;
    case "monthly_pct":
      return row.monthly_pct;
    default:
      return null;
  }
}

export function Targets({ rows }: { rows: TargetRow[] }) {
  const [userFilter, setUserFilter] = useState("");
  const users = useMemo(() => rows.map((r) => r.name), [rows]);
  const visible = userFilter ? rows.filter((r) => r.name === userFilter) : rows;
  const { sorted, field, direction, toggle } = useSort(visible, getValue);

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-normal text-ink">Targets</h2>
          <p className="mt-1 text-[10px] text-muted">Weekly and monthly performance by user</p>
        </div>
        {users.length > 1 && (
          <select
            aria-label="Filter targets by user"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-[#e7e5e4] bg-white px-2 py-1 text-[10px] font-semibold text-ink"
          >
            <option value="">All users</option>
            {users.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>
      <table className="mt-4 w-full text-[13px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
            <SortableHeader label="Name" field="name" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
            <SortableHeader label="Weekly target" field="weekly_pct" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
            <SortableHeader label="Monthly target" field="monthly_pct" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const color = ROW_COLORS[idx % ROW_COLORS.length];
            return (
              <tr key={row.user_id} className="border-t border-[#e7e5e4]">
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      {initials(row.name)}
                    </div>
                    <span className="font-medium text-ink">{row.name}</span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">
                      {row.weekly_completed}/{row.weekly_due}
                    </span>
                    <div className="h-1.5 w-16 rounded-full bg-[#eee]">
                      <div className="h-1.5 rounded-full" style={{ width: `${row.weekly_pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[11px] text-gray-500">{row.weekly_pct}%</span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">
                      {row.monthly_completed}/{row.monthly_due}
                    </span>
                    <div className="h-1.5 w-16 rounded-full bg-[#eee]">
                      <div className="h-1.5 rounded-full" style={{ width: `${row.monthly_pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[11px] text-gray-500">{row.monthly_pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
