import { Briefcase, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import type { Product } from "../../lib/types";

export function ProductsPanel() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shadeDrafts, setShadeDrafts] = useState<Record<number, string>>({});
  const [addingShadeFor, setAddingShadeFor] = useState<number | null>(null);
  const [removingVariantId, setRemovingVariantId] = useState<number | null>(null);

  function loadProducts() {
    api.get<Product[]>("/products").then((res) => setProducts(res.data));
  }

  useEffect(loadProducts, []);

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
        <h3 className="text-sm font-semibold text-ink">Available products</h3>
        <p className="mb-3 mt-0.5 text-xs text-gray-500">{products.length} universal product names</p>
        <div className="flex flex-col gap-2">
          {products.map((p) => (
            <div key={p.id} className="rounded-card border border-[#e7e5e4] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink">{p.name}</div>
                  <div className="text-xs text-gray-500">Available to all users</div>
                </div>
                <button
                  onClick={() => handleRemove(p)}
                  disabled={removingId === p.id}
                  className="text-sm font-semibold text-[#cf4e43] hover:underline disabled:opacity-50"
                >
                  {removingId === p.id ? "Removing..." : "Remove"}
                </button>
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
          {products.length === 0 && <p className="text-sm text-gray-400">No products yet.</p>}
        </div>
      </div>
    </div>
  );
}
