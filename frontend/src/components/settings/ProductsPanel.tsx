import { Briefcase } from "lucide-react";
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

  function loadProducts() {
    api.get<Product[]>("/products").then((res) => setProducts(res.data));
  }

  useEffect(loadProducts, []);

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
            <div key={p.id} className="flex items-center justify-between rounded-card border border-[#e7e5e4] p-4">
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
          ))}
          {products.length === 0 && <p className="text-sm text-gray-400">No products yet.</p>}
        </div>
      </div>
    </div>
  );
}
