import { Check, Pencil, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import type { ProductPerformance as ProductPerformanceType } from "../../lib/types";

const ROW_COLORS = ["#5B5CE2", "#8B8BF2", "#F06E62", "#238B57", "#E6A23C"];

export function ProductPerformance({
  products,
  onChanged,
}: {
  products: ProductPerformanceType[];
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const employees = useMemo(() => [...new Set(products.map((p) => p.owner_name))].sort(), [products]);
  const visible = employeeFilter ? products.filter((p) => p.owner_name === employeeFilter) : products;

  function canEdit(product: ProductPerformanceType) {
    return !!user && (user.role === "admin" || product.owner_id === user.id);
  }

  function startEdit(product: ProductPerformanceType) {
    setEditingId(product.id);
    setEditValue(String(product.target_videos));
  }

  async function saveTarget(productId: number) {
    const value = Number(editValue);
    if (!Number.isFinite(value) || value < 0) return;
    setSaving(true);
    try {
      await api.patch(`/products/${productId}`, { target_videos: value });
      setEditingId(null);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-normal text-ink">Product-wise performance</h2>
          <p className="mt-1 text-[10px] text-muted">Videos live against each product target</p>
        </div>
        {employees.length > 1 && (
          <select
            aria-label="Filter products by employee"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="rounded-lg border border-[#e7e5e4] bg-white px-2 py-1 text-[10px] font-semibold text-ink"
          >
            <option value="">All employees</option>
            {employees.map((name) => (
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
          const isEditing = editingId === product.id;
          return (
            <div key={product.id}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs font-medium text-ink">{product.name}</span>
                  <span className="text-[11px] text-gray-400">{product.owner_name}</span>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTarget(product.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-16 rounded-md border border-gray-300 px-1.5 py-0.5 text-xs"
                    />
                    <button
                      onClick={() => saveTarget(product.id)}
                      disabled={saving}
                      title="Save target"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      title="Cancel"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-surface"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <strong className="font-semibold text-ink">{product.videos_live} live</strong>{" "}
                    <em className="not-italic">of {product.target_videos}</em>
                    {canEdit(product) && (
                      <button
                        onClick={() => startEdit(product)}
                        title="Set target"
                        className="flex h-5 w-5 items-center justify-center rounded-md text-gray-300 hover:bg-surface hover:text-brand-600"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#eee]">
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
        {products.length === 0 && <p className="text-sm text-gray-400">No products yet.</p>}
      </div>
    </div>
  );
}
