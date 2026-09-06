import { Briefcase, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import type { Product } from "../../lib/types";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Disabled", value: "disabled" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

export function ProductsPanel() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shadeDrafts, setShadeDrafts] = useState<Record<number, string>>({});
  const [addingShadeFor, setAddingShadeFor] = useState<number | null>(null);
  const [removingVariantId, setRemovingVariantId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkToggling, setBulkToggling] = useState(false);

  function loadProducts() {
    api.get<Product[]>("/products", { params: { include_inactive: true } }).then((res) => setProducts(res.data));
  }

  useEffect(loadProducts, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "disabled" && p.is_active) return false;
      if (query && !p.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [products, search, statusFilter]);

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.delete(p.id));
        return next;
      }
      return new Set([...prev, ...filteredProducts.map((p) => p.id)]);
    });
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddShade(productId: number) {
    const shadeName = (shadeDrafts[productId] ?? "").trim();
    if (!shadeName) return;
    setError(null);
    setAddingShadeFor(productId);
    try {
      await api.post(`/products/${productId}/variants`, { name: shadeName });
      setShadeDrafts((prev) => ({ ...prev, [productId]: "" }));
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not add this shade.");
    } finally {
      setAddingShadeFor(null);
    }
  }

  async function handleRemoveShade(productId: number, variantId: number, variantName: string) {
    if (!confirm(`Remove shade "${variantName}"?`)) return;
    setError(null);
    setRemovingVariantId(variantId);
    try {
      await api.delete(`/products/${productId}/variants/${variantId}`);
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not remove this shade.");
    } finally {
      setRemovingVariantId(null);
    }
  }

  async function handleAdd() {
    if (!name.trim() || !user) return;
    setError(null);
    setAdding(true);
    try {
      await api.post("/products", { name: name.trim(), owner_id: user.id, target_videos: 0 });
      setName("");
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not add this product.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(product: Product) {
    if (!confirm(`Remove "${product.name}" from the shared product master?`)) return;
    setError(null);
    setRemovingId(product.id);
    try {
      await api.delete(`/products/${product.id}`);
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not remove this product.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleToggleOne(product: Product) {
    setError(null);
    setTogglingId(product.id);
    try {
      await api.patch(`/products/${product.id}`, { is_active: !product.is_active });
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not update this product.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleBulkToggle(is_active: boolean) {
    if (selectedIds.size === 0) return;
    setError(null);
    setBulkToggling(true);
    try {
      await api.post("/products/bulk-toggle", { product_ids: [...selectedIds], is_active });
      setSelectedIds(new Set());
      loadProducts();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not update these products.");
    } finally {
      setBulkToggling(false);
    }
  }

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <Briefcase size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">Universal product master</h2>
            <p className="text-sm text-gray-500">Add products once and make the same approved names available to every user.</p>
          </div>
        </div>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-600">Admin only</span>
      </div>

      <div className="my-4 border-t border-gray-100" />

      <div className="rounded-card border border-[#e7e5e4] bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">Add a product</h3>
        <p className="mb-3 mt-0.5 text-xs text-gray-500">Duplicate names are blocked automatically.</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Enter product name"
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={!name.trim() || adding}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add product"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Available products</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {products.length} universal product names · {products.filter((p) => !p.is_active).length} disabled
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Disabled products are hidden from every product picker and filter, but stay fully intact on any
            collaboration that already uses them.
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-full max-w-[320px] items-center gap-2 rounded-lg border border-[#e7e5e4] bg-white px-2.5">
            <Search size={14} className="shrink-0 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full text-xs text-ink placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <div className="flex h-9 items-center gap-1 rounded-lg border border-[#e7e5e4] bg-white p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  statusFilter === f.value ? "bg-brand-50 text-brand-600" : "text-gray-500 hover:bg-surface"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-white px-2.5 text-xs text-gray-600">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="h-3.5 w-3.5 rounded" />
            Select all {statusFilter !== "all" ? statusFilter : "shown"}
          </label>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-[#e7e5e4] bg-surface px-4 py-2 text-xs">
            <span className="font-semibold text-ink">
              {selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkToggle(false)}
                disabled={bulkToggling}
                className="rounded-lg border border-[#f5d3d0] bg-white px-3 py-1.5 font-bold text-[#cf4e43] hover:bg-[#fff0ed] disabled:opacity-50"
              >
                {bulkToggling ? "Working..." : "Disable selected"}
              </button>
              <button
                onClick={() => handleBulkToggle(true)}
                disabled={bulkToggling}
                className="rounded-lg border border-[#c8c6f5] bg-white px-3 py-1.5 font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
              >
                {bulkToggling ? "Working..." : "Enable selected"}
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="font-semibold text-gray-500 hover:text-ink">
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className={`rounded-card border p-4 ${p.is_active ? "border-[#e7e5e4]" : "border-[#e7e5e4] bg-surface opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {p.name}
                      {!p.is_active && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.is_active ? "Available to all users" : "Hidden from pickers and filters"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleOne(p)}
                    disabled={togglingId === p.id}
                    className={`text-sm font-semibold hover:underline disabled:opacity-50 ${
                      p.is_active ? "text-[#cf4e43]" : "text-brand-600"
                    }`}
                  >
                    {togglingId === p.id ? "Working..." : p.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => handleRemove(p)}
                    disabled={removingId === p.id}
                    className="text-sm font-semibold text-[#cf4e43] hover:underline disabled:opacity-50"
                  >
                    {removingId === p.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>

              <div className="mt-3 border-t border-[#e7e5e4] pt-3">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Shades / variants
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {p.variants.map((v) => (
                    <span
                      key={v.id}
                      className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink"
                    >
                      {v.name}
                      <button
                        onClick={() => handleRemoveShade(p.id, v.id, v.name)}
                        disabled={removingVariantId === v.id}
                        title={`Remove ${v.name}`}
                        className="text-gray-400 hover:text-[#cf4e43] disabled:opacity-50"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {p.variants.length === 0 && <span className="text-xs text-gray-400">No shades added yet</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    value={shadeDrafts[p.id] ?? ""}
                    onChange={(e) => setShadeDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddShade(p.id)}
                    placeholder="e.g. Rose Gold"
                    className="flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => handleAddShade(p.id)}
                    disabled={!(shadeDrafts[p.id] ?? "").trim() || addingShadeFor === p.id}
                    className="flex items-center gap-1 rounded-md border border-[#e7e5e4] px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface disabled:opacity-50"
                  >
                    <Plus size={12} />
                    {addingShadeFor === p.id ? "Adding..." : "Add shade"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && <p className="text-sm text-gray-400">No products match.</p>}
        </div>
      </div>
    </div>
  );
}
