import { useSort } from "../../hooks/useSort";
import { formatCurrency } from "../../lib/format";
import { SortableHeader } from "../shared/SortableHeader";
import type { AnalyticsProductPerformanceRow } from "../../lib/types";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

function getValue(row: AnalyticsProductPerformanceRow, field: string): unknown {
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

export function ProductPerformanceTable({
  rows,
  showCostPerComment,
}: {
  rows: AnalyticsProductPerformanceRow[];
  showCostPerComment: boolean;
}) {
  const { sorted, field, direction, toggle } = useSort(rows, getValue);

  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">Product performance</h3>
      <p className="mb-2 text-xs text-muted">
        Attributed video credit, views, comments{showCostPerComment ? " and cost efficiency" : ""}.
      </p>
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
              {sorted.map((row) => (
                <tr key={row.product_id} className="border-t border-gray-100">
                  <td className="py-2.5 pl-4 pr-3 text-[9px] font-extrabold text-ink">{row.product_name}</td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.videos}</td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.views.toLocaleString("en-IN")}</td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.comments.toLocaleString("en-IN")}</td>
                  {showCostPerComment && (
                    <td className="py-2.5 pr-4 text-[8px] font-semibold text-[#55515c]">{formatCurrency(row.cost_per_comment)}</td>
                  )}
                </tr>
              ))}
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
