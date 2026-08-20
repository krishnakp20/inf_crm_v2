import { Target, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSort } from "../../hooks/useSort";
import { api } from "../../lib/api";
import { SortableHeader } from "../shared/SortableHeader";
import type { Product, ProductTarget } from "../../lib/types";

function getValue(t: ProductTarget, field: string): unknown {
  switch (field) {
    case "product_name":
      return t.product_name;
    case "weekly_target":
      return t.weekly_target;
    case "monthly_target":
      return t.monthly_target;
    case "monthly_progress":
      return t.monthly_progress;
    default:
      return null;
  }
}

export function SetTargetDrawer({
  products,
  onClose,
}: {
  products: Product[];
  onClose: () => void;
}) {
  const [targets, setTargets] = useState<ProductTarget[]>([]);
  const { sorted: sortedTargets, field, direction, toggle } = useSort(targets, getValue);
  const [productId, setProductId] = useState<number | "">(products[0]?.id ?? "");
  const [weeklyTarget, setWeeklyTarget] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadTargets() {
    api.get<ProductTarget[]>("/product-targets").then((res) => setTargets(res.data));
  }

  useEffect(loadTargets, []);

  async function handleSave() {
    setError(null);
    if (!productId || !weeklyTarget || !monthlyTarget) {
      setError("Choose a product and fill in both targets.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/product-targets", {
        product_id: productId,
        weekly_target: Number(weeklyTarget),
        monthly_target: Number(monthlyTarget),
      });
      setWeeklyTarget("");
      setMonthlyTarget("");
      loadTargets();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not save this target.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-full w-[480px] flex-col bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Target size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Set my product targets</h2>
              <p className="text-xs text-gray-500">Only you can set targets for your own performance.</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 rounded-card border border-[#e7e5e4] p-3">
            <p className="text-xs font-semibold text-ink">Synced product names</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Choose from the shared product master so reporting never creates duplicate product names.
            </p>

            <label className="mb-1 mt-3 block text-xs font-medium text-gray-700">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(Number(e.target.value))}
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Weekly target</label>
                <input
                  type="number"
                  min={0}
                  value={weeklyTarget}
                  onChange={(e) => setWeeklyTarget(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Monthly target</label>
                <input
                  type="number"
                  min={0}
                  value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save target"}
            </button>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#e7e5e4] text-left uppercase tracking-wide text-gray-400">
                <SortableHeader label="Product" field="product_name" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
                <SortableHeader label="Weekly" field="weekly_target" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
                <SortableHeader label="Monthly" field="monthly_target" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
                <SortableHeader label="Progress" field="monthly_progress" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sortedTargets.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="py-2 font-medium text-ink">{t.product_name}</td>
                  <td className="py-2 text-gray-600">{t.weekly_target}</td>
                  <td className="py-2 text-gray-600">{t.monthly_target}</td>
                  <td className="py-2 text-gray-600">
                    {t.monthly_progress}/{t.monthly_target}
                  </td>
                </tr>
              ))}
              {targets.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    No targets set yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
