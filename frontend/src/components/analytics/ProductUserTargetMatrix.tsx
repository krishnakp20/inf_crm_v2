import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { SortDirection } from "../../lib/sort";
import type { AnalyticsMatrixCell, AnalyticsProductUserMatrix, AnalyticsProductUserMatrixRow } from "../../lib/types";
import { SortableHeader } from "../shared/SortableHeader";

const TH = "py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#918d97]";

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

type DisplayRow =
  | { kind: "product"; row: AnalyticsProductUserMatrixRow }
  | {
      kind: "group";
      parent: string;
      members: AnalyticsProductUserMatrixRow[];
      cells: AnalyticsMatrixCell[];
      total: AnalyticsMatrixCell;
    };

function sumCells(cells: AnalyticsMatrixCell[]): AnalyticsMatrixCell {
  return {
    achieved: Math.round(cells.reduce((sum, c) => sum + c.achieved, 0) * 100) / 100,
    target: Math.round(cells.reduce((sum, c) => sum + c.target, 0) * 100) / 100,
  };
}

// Products that share a group roll up into one expandable row (groups A-Z first, then ungrouped products).
// The Total row/column still come from the server, so grouping never changes any figure.
function buildDisplayRows(matrix: AnalyticsProductUserMatrix): DisplayRow[] {
  const grouped = new Map<string, AnalyticsProductUserMatrixRow[]>();
  const loose: AnalyticsProductUserMatrixRow[] = [];
  for (const row of matrix.rows) {
    if (!row.parent) loose.push(row);
    else grouped.set(row.parent, [...(grouped.get(row.parent) ?? []), row]);
  }
  const groups = [...grouped.keys()].sort().map((parent): DisplayRow => {
    const members = grouped.get(parent)!;
    return {
      kind: "group",
      parent,
      members,
      cells: matrix.users.map((_, idx) => sumCells(members.map((m) => m.cells[idx]))),
      total: sumCells(members.map((m) => m.total)),
    };
  });
  return [...groups, ...loose.map((row): DisplayRow => ({ kind: "product", row }))];
}

const NAME_FIELD = "name";
const TOTAL_FIELD = "total";
const userField = (userId: number) => `user-${userId}`;

export function ProductUserTargetMatrix({ matrix }: { matrix: AnalyticsProductUserMatrix }) {
  const [view, setView] = useState<ViewMode>("comparison");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Click a header: numbers sort High -> Low first, then Low -> High, then back to the default order.
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const baseRows = useMemo(() => buildDisplayRows(matrix), [matrix]);

  function toggleSort(field: string) {
    const firstDir: SortDirection = field === NAME_FIELD ? "asc" : "desc";
    if (sortField !== field) {
      setSortField(field);
      setSortDir(firstDir);
    } else if (sortDir === firstDir) {
      setSortDir(firstDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(null);
    }
  }

  // "Target" view sorts by target; "Achieved" and "Target vs Achieved" sort by achieved.
  function sortValue(cell: AnalyticsMatrixCell): number {
    return view === "target" ? cell.target : cell.achieved;
  }

  const displayRows = useMemo(() => {
    if (!sortField) return baseRows;
    const userIdx = sortField.startsWith("user-")
      ? matrix.users.findIndex((u) => userField(u.user_id) === sortField)
      : -1;
    const nameOf = (r: DisplayRow) => (r.kind === "group" ? r.parent : r.row.product_name);
    const cellOf = (cells: AnalyticsMatrixCell[], total: AnalyticsMatrixCell) =>
      sortField === TOTAL_FIELD ? total : cells[userIdx];
    const compareRows = (
      a: { name: string; cell?: AnalyticsMatrixCell },
      b: { name: string; cell?: AnalyticsMatrixCell }
    ) => {
      const cmp =
        sortField === NAME_FIELD
          ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
          : sortValue(a.cell!) - sortValue(b.cell!);
      const directed = sortDir === "asc" ? cmp : -cmp;
      return directed !== 0 ? directed : a.name.localeCompare(b.name);
    };
    const sortProducts = (rows: AnalyticsProductUserMatrixRow[]) =>
      [...rows].sort((a, b) =>
        compareRows(
          { name: a.product_name, cell: cellOf(a.cells, a.total) },
          { name: b.product_name, cell: cellOf(b.cells, b.total) }
        )
      );
    const sorted = baseRows.map((r): DisplayRow => (r.kind === "group" ? { ...r, members: sortProducts(r.members) } : r));
    return sorted.sort((a, b) =>
      compareRows(
        { name: nameOf(a), cell: a.kind === "group" ? cellOf(a.cells, a.total) : cellOf(a.row.cells, a.row.total) },
        { name: nameOf(b), cell: b.kind === "group" ? cellOf(b.cells, b.total) : cellOf(b.row.cells, b.row.total) }
      )
    );
  }, [baseRows, sortField, sortDir, view, matrix.users]);

  function toggleExpanded(parent: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parent)) next.delete(parent);
      else next.add(parent);
      return next;
    });
  }

  function renderProductRow(row: AnalyticsProductUserMatrixRow, indented: boolean) {
    return (
      <tr key={row.product_id} className="border-t border-gray-100">
        <td className={`py-2.5 pr-3 text-[12px] font-extrabold text-ink ${indented ? "pl-9" : "pl-4"}`}>
          {row.product_name}
        </td>
        {row.cells.map((cell, idx) => (
          <td key={matrix.users[idx].user_id} className="py-2.5 pr-3 text-[11px] text-[#55515c]">
            {formatCell(cell, view)}
          </td>
        ))}
        <td className="py-2.5 pr-4 text-[11px] font-extrabold text-ink">{formatCell(row.total, view)}</td>
      </tr>
    );
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Product performance, user-wise</h3>
          <p className="text-xs text-muted">Monthly target vs live-video credit, per product and user. Click a user or Total to sort high to low.</p>
        </div>
        <div className="flex h-8 items-center gap-1 rounded-lg border border-[#e7e5e4] bg-white p-1">
          {VIEW_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setView(o.value)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
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
                <SortableHeader label="Users" field={NAME_FIELD} activeField={sortField} direction={sortDir} onSort={toggleSort} className={`${TH} pl-4`} />
                {matrix.users.map((u) => (
                  <SortableHeader
                    key={u.user_id}
                    label={u.user_name}
                    field={userField(u.user_id)}
                    activeField={sortField}
                    direction={sortDir}
                    onSort={toggleSort}
                    className={TH}
                  />
                ))}
                <SortableHeader label="Total" field={TOTAL_FIELD} activeField={sortField} direction={sortDir} onSort={toggleSort} className={`${TH} pr-4`} />
              </tr>
            </thead>
            <tbody>
              {displayRows.map((entry) => {
                if (entry.kind === "product") return renderProductRow(entry.row, false);
                const isOpen = expanded.has(entry.parent);
                return (
                  <Fragment key={`group-${entry.parent}`}>
                    <tr
                      onClick={() => toggleExpanded(entry.parent)}
                      aria-expanded={isOpen}
                      className="cursor-pointer border-t border-gray-100 hover:bg-surface"
                    >
                      <td className="py-2.5 pl-4 pr-3 text-[12px] font-extrabold text-ink">
                        <span className="flex items-center gap-1.5">
                          {isOpen ? (
                            <ChevronDown size={12} className="shrink-0 text-gray-400" />
                          ) : (
                            <ChevronRight size={12} className="shrink-0 text-gray-400" />
                          )}
                          {entry.parent}
                          <span className="text-[11px] font-normal text-gray-400">
                            ({entry.members.length} product{entry.members.length !== 1 ? "s" : ""})
                          </span>
                        </span>
                      </td>
                      {entry.cells.map((cell, idx) => (
                        <td key={matrix.users[idx].user_id} className="py-2.5 pr-3 text-[11px] font-bold text-ink">
                          {formatCell(cell, view)}
                        </td>
                      ))}
                      <td className="py-2.5 pr-4 text-[11px] font-extrabold text-ink">{formatCell(entry.total, view)}</td>
                    </tr>
                    {isOpen && entry.members.map((m) => renderProductRow(m, true))}
                  </Fragment>
                );
              })}
              {matrix.rows.length === 0 && (
                <tr>
                  <td colSpan={matrix.users.length + 2} className="py-6 text-center text-sm text-gray-400">
                    No product targets set for this scope.
                  </td>
                </tr>
              )}
              {matrix.rows.length > 0 && (
                <tr className="border-t border-[#e7e5e4] bg-surface">
                  <td className="py-2.5 pl-4 pr-3 text-[12px] font-extrabold text-ink">Total</td>
                  {matrix.column_totals.map((cell, idx) => (
                    <td key={matrix.users[idx].user_id} className="py-2.5 pr-3 text-[11px] font-extrabold text-ink">
                      {formatCell(cell, view)}
                    </td>
                  ))}
                  <td className="py-2.5 pr-4 text-[11px] font-extrabold text-ink">{formatCell(matrix.grand_total, view)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
