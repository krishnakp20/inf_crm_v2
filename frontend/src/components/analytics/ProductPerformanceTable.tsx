import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useSort } from "../../hooks/useSort";
import { formatCurrency } from "../../lib/format";
import { SortableHeader } from "../shared/SortableHeader";
import type { AnalyticsProductPerformanceRow } from "../../lib/types";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

type DisplayRow =
  | { kind: "product"; row: AnalyticsProductPerformanceRow }
  | { kind: "group"; parent: string; members: AnalyticsProductPerformanceRow[] };

function aggregate(members: AnalyticsProductPerformanceRow[]) {
  const videos = members.reduce((sum, m) => sum + m.videos, 0);
  const views = members.reduce((sum, m) => sum + m.views, 0);
  const comments = members.reduce((sum, m) => sum + m.comments, 0);
  const totalCost = members.reduce((sum, m) => sum + (m.total_cost ?? 0), 0);
  const hasCost = members.some((m) => m.total_cost != null);
  const cost_per_comment = hasCost && comments > 0 ? totalCost / comments : null;
  return { videos, views, comments, cost_per_comment };
}

function getValue(displayRow: DisplayRow, field: string): unknown {
  if (displayRow.kind === "product") {
    const row = displayRow.row;
    switch (field) {
      case "product_name":
        return row.product_name;
      case "videos":
        return row.videos;
      case "views":
        return row.views;
      case "comments":
        return row.comments;
      case "cost_per_comment":
        return row.cost_per_comment;
      default:
        return null;
    }
  }
  const agg = aggregate(displayRow.members);
  switch (field) {
    case "product_name":
      return displayRow.parent;
    case "videos":
      return agg.videos;
    case "views":
      return agg.views;
    case "comments":
      return agg.comments;
    case "cost_per_comment":
      return agg.cost_per_comment;
    default:
      return null;
  }
}

export function ProductPerformanceTable({
  rows,
  showCostPerComment,
}: {
  rows: AnalyticsProductPerformanceRow[];
  showCostPerComment: boolean;
}) {
  const [groupFilter, setGroupFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(
    () => [...new Set(rows.map((r) => r.product_parent).filter((p): p is string => !!p))].sort(),
    [rows]
  );

  const displayRows = useMemo(() => {
    const built: DisplayRow[] = [];
    const groupIndex = new Map<string, number>();
    for (const row of rows) {
      if (!row.product_parent) {
        built.push({ kind: "product", row });
        continue;
      }
      const existingIdx = groupIndex.get(row.product_parent);
      if (existingIdx === undefined) {
        groupIndex.set(row.product_parent, built.length);
        built.push({ kind: "group", parent: row.product_parent, members: [row] });
      } else {
        (built[existingIdx] as { kind: "group"; parent: string; members: AnalyticsProductPerformanceRow[] }).members.push(
          row
        );
      }
    }
    return groupFilter ? built.filter((r) => (r.kind === "group" ? r.parent === groupFilter : false)) : built;
  }, [rows, groupFilter]);

  const { sorted, field, direction, toggle } = useSort(displayRows, getValue);

  function toggleExpanded(parent: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parent)) next.delete(parent);
      else next.add(parent);
      return next;
    });
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Product performance</h3>
          <p className="text-xs text-muted">
            Attributed video credit, views, comments{showCostPerComment ? " and cost efficiency" : ""}.
          </p>
        </div>
        {groups.length > 0 && (
          <select
            aria-label="Filter products by group"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-8 rounded-lg border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="dashboard-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-surface text-left">
                <SortableHeader label="Product" field="product_name" activeField={field} direction={direction} onSort={toggle} className={`${TH} pl-4`} />
                <SortableHeader label="Videos" field="videos" activeField={field} direction={direction} onSort={toggle} className={TH} />
                <SortableHeader label="Views" field="views" activeField={field} direction={direction} onSort={toggle} className={TH} />
                <SortableHeader label="Comments" field="comments" activeField={field} direction={direction} onSort={toggle} className={TH} />
                {showCostPerComment && (
                  <SortableHeader label="Cost/Comment" field="cost_per_comment" activeField={field} direction={direction} onSort={toggle} className={`${TH} pr-4`} />
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((displayRow) => {
                if (displayRow.kind === "product") {
                  const row = displayRow.row;
                  return (
                    <tr key={`p-${row.product_id}`} className="border-t border-gray-100">
                      <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">{row.product_name}</td>
                      <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.videos}</td>
                      <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.views.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.comments.toLocaleString("en-IN")}</td>
                      {showCostPerComment && (
                        <td className="py-2.5 pr-4 text-[8px] font-semibold text-[#55515c]">{formatCurrency(row.cost_per_comment)}</td>
                      )}
                    </tr>
                  );
                }

                const isOpen = !!groupFilter || expanded.has(displayRow.parent);
                const agg = aggregate(displayRow.members);
                return (
                  <Fragment key={`g-${displayRow.parent}`}>
                    <tr className="border-t border-gray-100 bg-surface/60">
                      <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(displayRow.parent)}
                          className="flex items-center gap-1.5"
                        >
                          {isOpen ? (
                            <ChevronDown size={12} className="shrink-0 text-gray-400" />
                          ) : (
                            <ChevronRight size={12} className="shrink-0 text-gray-400" />
                          )}
                          {displayRow.parent}
                          <span className="text-[8px] font-semibold text-gray-400">
                            ({displayRow.members.length} product{displayRow.members.length !== 1 ? "s" : ""})
                          </span>
                        </button>
                      </td>
                      <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">{agg.videos}</td>
                      <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">{agg.views.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">{agg.comments.toLocaleString("en-IN")}</td>
                      {showCostPerComment && (
                        <td className="py-2.5 pr-4 text-[8px] font-semibold text-[#55515c]">{formatCurrency(agg.cost_per_comment)}</td>
                      )}
                    </tr>
                    {isOpen &&
                      displayRow.members.map((row) => (
                        <tr key={`p-${row.product_id}`} className="border-t border-gray-100">
                          <td className="py-2.5 pl-8 pr-3 text-[9px] text-[#55515c]">{row.product_name}</td>
                          <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.videos}</td>
                          <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.views.toLocaleString("en-IN")}</td>
                          <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.comments.toLocaleString("en-IN")}</td>
                          {showCostPerComment && (
                            <td className="py-2.5 pr-4 text-[8px] text-[#55515c]">{formatCurrency(row.cost_per_comment)}</td>
                          )}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={showCostPerComment ? 5 : 4} className="py-6 text-center text-sm text-gray-400">
                    No Live videos in scope for this range.
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
