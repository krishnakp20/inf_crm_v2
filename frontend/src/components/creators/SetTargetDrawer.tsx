import { Check, Pencil, Search, Target, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSort } from "../../hooks/useSort";
import { api } from "../../lib/api";
import { SearchableSelect } from "../shared/SearchableSelect";
import { SortableHeader } from "../shared/SortableHeader";
import type { Product, ProductTarget, ProductTargetMonth, User } from "../../lib/types";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + n, 1));
}

function monthLabel(key: string, short = false): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTH_NAMES[m - 1];
  return `${short ? name.slice(0, 3) : name} ${y}`;
}

function getValue(t: ProductTarget, field: string): unknown {
  switch (field) {
    case "product_name":
      return t.product_name;
    case "monthly_target":
      return t.monthly_target;
    case "weekly_target":
      return t.weekly_target;
    case "weekly_progress":
      return t.weekly_progress;
    case "monthly_progress":
      return t.monthly_progress;
    case "source":
      return t.source;
    default:
      return null;
  }
}

/** Splits a whole-number total across n products so the shares always add up to the total
 * (100 across 3 -> 34, 33, 33; the first products take the remainder). */
function splitTarget(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function SetTargetDrawer({
  products,
  advisors,
  onClose,
}: {
  products: Product[];
  /** Admin only -- when given, shows a "Set target for" picker instead of
   * implicitly managing the caller's own targets. */
  advisors?: User[];
  onClose: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState<number | "">(advisors?.[0]?.id ?? "");
  const [targets, setTargets] = useState<ProductTarget[]>([]);
  const thisMonth = monthKeyOf(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [monthList, setMonthList] = useState<ProductTargetMonth[]>([]);
  const { sorted: sortedTargets, field, direction, toggle } = useSort(targets, getValue);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inline edit of an already-set target (click its Monthly target value in the table).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const managingOther = !!advisors;
  const targetUserId = managingOther ? selectedUserId : undefined;

  function loadTargets() {
    if (managingOther && !targetUserId) {
      setTargets([]);
      return;
    }
    api
      .get<ProductTarget[]>("/product-targets", { params: { user_id: targetUserId || undefined, month } })
      .then((res) => setTargets(res.data));
    loadMonthList();
  }

  function loadMonthList() {
    if (managingOther && !targetUserId) {
      setMonthList([]);
      return;
    }
    api
      .get<ProductTargetMonth[]>("/product-targets/months", { params: { user_id: targetUserId || undefined } })
      .then((res) => setMonthList(res.data));
  }

  useEffect(loadTargets, [targetUserId, month]);

  // Last month through six months ahead, plus any month that already has targets of its own.
  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (let n = -1; n <= 6; n++) keys.add(addMonths(thisMonth, n));
    monthList.forEach((m) => keys.add(m.month));
    keys.add(month);
    return [...keys].sort().map((key) => ({ value: key, label: monthLabel(key) + (key === thisMonth ? " (this month)" : "") }));
  }, [monthList, month, thisMonth]);

  const visibleProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, productSearch]);

  // In product-list order, so the remainder of an uneven split lands on a predictable product.
  const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));
  const totalTarget = monthlyTarget === "" ? null : Number(monthlyTarget);
  const shares =
    totalTarget !== null && Number.isInteger(totalTarget) && totalTarget >= 0 && selectedProducts.length > 0
      ? splitTarget(totalTarget, selectedProducts.length)
      : null;

  function toggleProduct(id: number) {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function startEdit(t: ProductTarget) {
    setEditingId(t.id);
    setEditValue(String(t.monthly_target));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(t: ProductTarget) {
    const value = Number(editValue);
    if (editValue === "" || !Number.isInteger(value) || value < 0) {
      setEditError("Enter a whole number.");
      return;
    }
    if (value === t.monthly_target) {
      cancelEdit();
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await api.post("/product-targets", {
        product_id: t.product_id,
        monthly_target: value,
        month,
        user_id: targetUserId || undefined,
      });
      setEditingId(null);
      loadTargets();
    } catch (err: any) {
      setEditError(err.response?.data?.detail ?? "Could not update this target.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (managingOther && !targetUserId) {
      setError("Choose a user first.");
      return;
    }
    if (selectedProducts.length === 0 || monthlyTarget === "") {
      setError("Choose at least one product and a monthly target.");
      return;
    }
    if (!shares) {
      setError("Monthly target must be a whole number.");
      return;
    }
    if (totalTarget! < selectedProducts.length) {
      setError(`Monthly target must be at least ${selectedProducts.length} so every product gets 1 or more.`);
      return;
    }
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        selectedProducts.map((p, i) =>
          api.post("/product-targets", {
            product_id: p.id,
            monthly_target: shares[i],
            month,
            user_id: targetUserId || undefined,
          })
        )
      );
      const failed = selectedProducts.filter((_, i) => results[i].status === "rejected");
      if (failed.length === 0) {
        setSelectedProductIds([]);
        setMonthlyTarget("");
      } else {
        // Keep only the ones that failed selected, so pressing Save again retries just those.
        setSelectedProductIds(failed.map((p) => p.id));
        setError(`Could not save the target for: ${failed.map((p) => p.name).join(", ")}. Please try again.`);
      }
      loadTargets();
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
              <h2 className="text-base font-semibold text-ink">
                {managingOther ? "Set product targets for a user" : "Set my product targets"}
              </h2>
              <p className="text-xs text-gray-500">Pick a month, then set its target.</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {advisors && (
            <div className="mb-5 rounded-card border border-[#e7e5e4] p-3">
              <label className="mb-1 block text-xs font-medium text-gray-700">Set target for</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select a user...</option>
                {advisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-5 rounded-card border border-[#e7e5e4] p-3">
            <label className="mb-1 block text-xs font-medium text-gray-700">Month</label>
            <SearchableSelect
              fullWidth
              ariaLabel="Target month"
              value={month}
              onChange={setMonth}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              options={monthOptions}
            />
            <p className="mt-1.5 text-[11px] text-gray-500">
              Targets you save below are for {monthLabel(month)}. A month with no target of its own uses the latest earlier month's.
            </p>
            {monthList.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Months with targets</p>
                <div className="flex flex-wrap gap-1.5">
                  {monthList.map((m) => (
                    <button
                      key={m.month}
                      type="button"
                      onClick={() => setMonth(m.month)}
                      title={`${m.product_count} product${m.product_count !== 1 ? "s" : ""}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        m.month === month
                          ? "border-brand-300 bg-brand-50 text-brand-600"
                          : "border-[#e7e5e4] text-ink hover:bg-surface"
                      }`}
                    >
                      {monthLabel(m.month, true)} · {m.total_target}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-5 rounded-card border border-[#e7e5e4] p-3">
            <p className="text-xs font-semibold text-ink">Synced product names</p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Choose from the shared product master so reporting never creates duplicate product names.
            </p>

            <div className="mb-1 mt-3 flex items-center justify-between">
              <label className="block text-xs font-medium text-gray-700">
                Products · {selectedProducts.length} selected
              </label>
              <div className="flex gap-3 text-[11px] font-semibold text-brand-600">
                <button type="button" onClick={() => setSelectedProductIds(products.map((p) => p.id))}>
                  Select all
                </button>
                <button type="button" onClick={() => setSelectedProductIds([])} className="text-gray-400">
                  Clear
                </button>
              </div>
            </div>
            <div className="mb-2 rounded-md border border-gray-300">
              <div className="flex items-center gap-1.5 border-b border-gray-200 px-2.5 py-1.5">
                <Search size={12} className="shrink-0 text-gray-400" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full text-xs text-ink placeholder:text-gray-400 focus:outline-none"
                />
              </div>
              <ul className="max-h-40 overflow-y-auto py-1">
                {visibleProducts.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1 text-xs text-ink hover:bg-surface">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  </li>
                ))}
                {visibleProducts.length === 0 && <li className="px-2.5 py-2 text-xs text-gray-400">No matches</li>}
              </ul>
            </div>

            <label className="mb-1 block text-xs font-medium text-gray-700">
              {selectedProducts.length > 1 ? "Total monthly target (split equally)" : "Monthly target"}
            </label>
            <input
              type="number"
              min={0}
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />

            {selectedProducts.length > 1 && (
              <div className="mt-2 rounded-md bg-surface p-2.5 text-[11px] text-gray-600">
                {shares ? (
                  <>
                    <p className="mb-1 font-semibold text-ink">
                      {totalTarget} across {selectedProducts.length} products:
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {selectedProducts.map((p, i) => (
                        <li key={p.id} className="flex justify-between gap-2">
                          <span className="truncate">{p.name}</span>
                          <span className="shrink-0 font-semibold text-ink">{shares[i]}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>Enter a whole-number total to see how it splits across the {selectedProducts.length} products.</p>
                )}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-gray-400">
              Saving replaces any target already set for the chosen products.
            </p>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving || (managingOther && !selectedUserId)}
              className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save target"}
            </button>
          </div>

          <p className="mb-2 text-[11px] text-gray-400">
            Targets for {monthLabel(month)}. Click a monthly target to change it for this month.
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#e7e5e4] text-left uppercase tracking-wide text-gray-400">
                <SortableHeader label="Product" field="product_name" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
                <SortableHeader label="Monthly target" field="monthly_target" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
                <SortableHeader label="Achieved" field="monthly_progress" activeField={field} direction={direction} onSort={toggle} className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sortedTargets.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="py-2 font-medium text-ink">
                    {t.product_name}
                    {t.source === "carried" && t.source_month && (
                      <div className="text-[10px] font-normal text-amber-600">Carried from {monthLabel(t.source_month)}</div>
                    )}
                    {t.source === "standing" && <div className="text-[10px] font-normal text-gray-400">Standing target</div>}
                  </td>
                  <td className="py-2 text-gray-600">
                    {editingId === t.id ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(t);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            disabled={editSaving}
                            className="w-16 rounded-md border border-brand-300 px-1.5 py-1 text-xs text-ink"
                          />
                          <button
                            type="button"
                            title="Save"
                            onClick={() => saveEdit(t)}
                            disabled={editSaving}
                            className="rounded-md bg-brand-600 p-1 text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            onClick={cancelEdit}
                            disabled={editSaving}
                            className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {editError && <p className="mt-1 text-[10px] text-red-600">{editError}</p>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Click to change this target"
                        onClick={() => startEdit(t)}
                        className="group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-brand-50 hover:text-brand-600"
                      >
                        {t.monthly_target}
                        <Pencil size={10} className="text-gray-300 group-hover:text-brand-600" />
                      </button>
                    )}
                  </td>
                  <td className="py-2 font-semibold text-ink">{t.monthly_progress}</td>
                </tr>
              ))}
              {targets.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-400">
                    {managingOther && !selectedUserId ? "Select a user above to see and set their targets." : "No targets set yet."}
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
