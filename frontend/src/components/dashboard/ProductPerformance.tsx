import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProductPerformance as ProductPerformanceType } from "../../lib/types";

const ROW_COLORS = ["#5B5CE2", "#8B8BF2", "#F06E62", "#238B57", "#E6A23C"];

type DisplayRow =
  | { kind: "product"; product: ProductPerformanceType }
  | { kind: "group"; parent: string; members: ProductPerformanceType[] };

function videosLiveFor(product: ProductPerformanceType, userFilter: string): number {
  return userFilter ? product.credit_by_owner?.[userFilter] ?? 0 : product.videos_live;
}

function progressPct(videosLive: number, targetVideos: number): number {
  // No target set (target_videos = 0) isn't "0% progress" -- with nothing
  // to divide by, any live video already exceeds it, so the bar shows full
  // rather than permanently stuck empty.
  if (targetVideos > 0) return Math.min((videosLive / targetVideos) * 100, 100);
  return videosLive > 0 ? 100 : 0;
}

export function ProductPerformance({ products }: { products: ProductPerformanceType[] }) {
  const [userFilter, setUserFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Real contributors (who actually delivered each product's live videos),
  // not products' static owner_name -- see credit_by_owner on the backend.
  const users = useMemo(
    () => [...new Set(products.flatMap((p) => Object.keys(p.credit_by_owner ?? {})))].sort(),
    [products]
  );
  const groups = useMemo(
    () => [...new Set(products.map((p) => p.parent).filter((p): p is string => !!p))].sort(),
    [products]
  );

  const byCredit = userFilter ? products.filter((p) => (p.credit_by_owner?.[userFilter] ?? 0) > 0) : products;

  const displayRows = useMemo(() => {
    const rows: DisplayRow[] = [];
    const groupIndex = new Map<string, number>();
    for (const product of byCredit) {
      if (!product.parent) {
        rows.push({ kind: "product", product });
        continue;
      }
      const existingIdx = groupIndex.get(product.parent);
      if (existingIdx === undefined) {
        groupIndex.set(product.parent, rows.length);
        rows.push({ kind: "group", parent: product.parent, members: [product] });
      } else {
        (rows[existingIdx] as { kind: "group"; parent: string; members: ProductPerformanceType[] }).members.push(
          product
        );
      }
    }
    return groupFilter ? rows.filter((r) => (r.kind === "group" ? r.parent === groupFilter : false)) : rows;
  }, [byCredit, groupFilter]);

  function toggleExpanded(parent: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parent)) next.delete(parent);
      else next.add(parent);
      return next;
    });
  }

  function renderProductRow(product: ProductPerformanceType, color: string, indent: boolean) {
    const videosLive = videosLiveFor(product, userFilter);
    const pct = progressPct(videosLive, product.target_videos);
    return (
      <div key={product.id} className={indent ? "pl-4" : undefined}>
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs font-medium text-ink">{product.name}</span>
          </div>
          <span className="text-xs text-gray-500">
            <strong className="font-semibold text-ink">{videosLive} live</strong>{" "}
            <em className="not-italic">of {product.target_videos}</em>
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#eee]">
          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-normal text-ink">Product-wise performance</h2>
          <p className="mt-1 text-[10px] text-muted">Videos live against each product target</p>
        </div>
        <div className="flex items-center gap-2">
          {groups.length > 0 && (
            <select
              aria-label="Filter products by group"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="rounded-lg border border-[#e7e5e4] bg-white px-2 py-1 text-[10px] font-semibold text-ink"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
          {users.length > 1 && (
            <select
              aria-label="Filter products by user"
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
      </div>
      <div className="mt-4 flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
        {displayRows.map((row, idx) => {
          const color = ROW_COLORS[idx % ROW_COLORS.length];
          if (row.kind === "product") return renderProductRow(row.product, color, false);

          const isOpen = !!groupFilter || expanded.has(row.parent);
          const targetVideos = row.members.reduce((sum, m) => sum + m.target_videos, 0);
          const videosLive = row.members.reduce((sum, m) => sum + videosLiveFor(m, userFilter), 0);
          const pct = progressPct(videosLive, targetVideos);
          return (
            <div key={row.parent}>
              <button
                type="button"
                onClick={() => toggleExpanded(row.parent)}
                className="mb-1 flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown size={12} className="shrink-0 text-gray-400" />
                  ) : (
                    <ChevronRight size={12} className="shrink-0 text-gray-400" />
                  )}
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold text-ink">{row.parent}</span>
                  <span className="text-[10px] text-gray-400">
                    ({row.members.length} product{row.members.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  <strong className="font-semibold text-ink">{videosLive} live</strong>{" "}
                  <em className="not-italic">of {targetVideos}</em>
                </span>
              </button>
              <div className="h-1.5 w-full rounded-full bg-[#eee]">
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              {isOpen && (
                <div className="mt-3 flex flex-col gap-3">
                  {row.members.map((m) => renderProductRow(m, color, true))}
                </div>
              )}
            </div>
          );
        })}
        {displayRows.length === 0 && <p className="text-sm text-gray-400">No products yet.</p>}
      </div>
    </div>
  );
}
