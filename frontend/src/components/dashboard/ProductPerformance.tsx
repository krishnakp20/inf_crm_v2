import { useMemo, useState } from "react";
import type { ProductPerformance as ProductPerformanceType } from "../../lib/types";

const ROW_COLORS = ["#5B5CE2", "#8B8BF2", "#F06E62", "#238B57", "#E6A23C"];

export function ProductPerformance({ products }: { products: ProductPerformanceType[] }) {
  const [userFilter, setUserFilter] = useState("");

  const users = useMemo(() => [...new Set(products.map((p) => p.owner_name))].sort(), [products]);
  const visible = userFilter ? products.filter((p) => p.owner_name === userFilter) : products;

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-normal text-ink">Product-wise performance</h2>
          <p className="mt-1 text-[10px] text-muted">Videos live against each product target</p>
        </div>
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
      <div className="mt-4 flex flex-col gap-3">
        {visible.map((product, idx) => {
          const color = ROW_COLORS[idx % ROW_COLORS.length];
          const pct = product.target_videos > 0 ? Math.min((product.videos_live / product.target_videos) * 100, 100) : 0;
          return (
            <div key={product.id}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs font-medium text-ink">{product.name}</span>
                  {userFilter && <span className="text-[11px] text-gray-400">{product.owner_name}</span>}
                </div>
                <span className="text-xs text-gray-500">
                  <strong className="font-semibold text-ink">{product.videos_live} live</strong>{" "}
                  <em className="not-italic">of {product.target_videos}</em>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#eee]">
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-gray-400">No products yet.</p>}
      </div>
    </div>
  );
}
