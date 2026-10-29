import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { SortDirection } from "../../lib/sort";
import { initials } from "../../lib/format";
import { SortableHeader } from "../shared/SortableHeader";
import type { TargetRow } from "../../lib/types";
import { SearchableSelect } from "../shared/SearchableSelect";

const ROW_COLORS = ["#5B5CE2", "#F06E62", "#238B57", "#E6A23C"];

const NAME_FIELD = "name";
const LIVE_FIELD = "monthly_completed";

// A user with no target set has nothing to measure a percentage against.
function hasTarget(row: TargetRow): boolean {
  return row.monthly_due > 0;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthInfo(offset: number): { key: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
}

export function Targets({ rows: thisMonthRows }: { rows: TargetRow[] }) {
  // The Dashboard sends this month's rows; last month is fetched when asked for, so Target vs Achieved can be checked.
  const [monthChoice, setMonthChoice] = useState<"this" | "last">("this");
  const [lastMonthRows, setLastMonthRows] = useState<TargetRow[] | null>(null);
  const thisMonth = monthInfo(0);
  const lastMonth = monthInfo(-1);

  useEffect(() => {
    if (monthChoice !== "last") return;
    setLastMonthRows(null);
    api
      .get<TargetRow[]>("/dashboard/targets", { params: { month: lastMonth.key } })
      .then((res) => setLastMonthRows(res.data))
      .catch(() => setLastMonthRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthChoice]);

  const loading = monthChoice === "last" && lastMonthRows === null;
  const rows = monthChoice === "last" ? lastMonthRows ?? [] : thisMonthRows;
  const [userFilter, setUserFilter] = useState("");
  const users = useMemo(() => rows.map((r) => r.name), [rows]);
  const visible = userFilter ? rows.filter((r) => r.name === userFilter) : rows;
  // Videos live sorts High -> Low first, then Low -> High, then back to the default order.
  const [field, setField] = useState<string | null>(null);
  const [direction, setDirection] = useState<SortDirection>("desc");

  function toggle(next: string) {
    const first: SortDirection = next === NAME_FIELD ? "asc" : "desc";
    if (field !== next) {
      setField(next);
      setDirection(first);
    } else if (direction === first) {
      setDirection(first === "asc" ? "desc" : "asc");
    } else {
      setField(null);
    }
  }

  const sorted = useMemo(() => {
    if (!field) return visible;
    return [...visible].sort((a, b) => {
      const cmp =
        field === NAME_FIELD
          ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          : a.monthly_completed - b.monthly_completed ||
            // Equal videos live: the one further along its target ranks first (users with no target last).
            (hasTarget(a) ? a.monthly_pct : -1) - (hasTarget(b) ? b.monthly_pct : -1);
      const directed = direction === "asc" ? cmp : -cmp;
      return directed !== 0 ? directed : a.name.localeCompare(b.name);
    });
  }, [visible, field, direction]);

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-normal text-ink">Targets</h2>
          <p className="mt-1 text-[10px] text-muted">
            Monthly performance by user · {monthChoice === "last" ? lastMonth.label : thisMonth.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-[#e7e5e4] bg-surface p-0.5">
            {(["this", "last"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => {
                  setUserFilter("");
                  setMonthChoice(choice);
                }}
                className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                  monthChoice === choice ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-ink"
                }`}
              >
                {choice === "this" ? "This month" : "Last month"}
              </button>
            ))}
          </div>
        {users.length > 1 && (
          <SearchableSelect
            ariaLabel="Filter targets by user"
            value={userFilter}
            onChange={setUserFilter}
            align="right"
            className="rounded-lg border border-[#e7e5e4] bg-white px-2 py-1 text-[10px] font-semibold text-ink"
            options={[{ value: "", label: "All users" }, ...users.map((name) => ({ value: name, label: name }))]}
          />
        )}
        </div>
      </div>
      <div className="mt-4 max-h-[520px] overflow-y-auto">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
            <SortableHeader label="Name" field="name" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
            <SortableHeader label="Monthly target" field={LIVE_FIELD} activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
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
                      {row.monthly_completed}/{hasTarget(row) ? row.monthly_due : "—"}
                    </span>
                    <div className="h-1.5 w-16 rounded-full bg-[#eee]">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${hasTarget(row) ? Math.min(row.monthly_pct, 100) : 0}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-500">{hasTarget(row) ? `${row.monthly_pct}%` : "—"}</span>
                  </div>
                </td>
              </tr>
            );
          })}
          {loading && (
            <tr>
              <td colSpan={2} className="py-4 text-center text-sm text-gray-400">
                Loading...
              </td>
            </tr>
          )}
          {!loading && sorted.length === 0 && (
            <tr>
              <td colSpan={2} className="py-4 text-center text-sm text-gray-400">
                No targets for this month.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
