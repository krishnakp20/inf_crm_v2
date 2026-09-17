import { Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { ContentCategory } from "../../lib/types";

export function ContentCategoryPanel() {
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadCategories() {
    api.get<ContentCategory[]>("/content-categories").then((res) => setCategories(res.data));
  }

  useEffect(loadCategories, []);

  async function handleAdd() {
    if (!name.trim()) return;
    setError(null);
    setAdding(true);
    try {
      await api.post("/content-categories", { name: name.trim() });
      setName("");
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not add this category.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(category: ContentCategory) {
    if (!confirm(`Remove "${category.name}" from the category list?`)) return;
    setError(null);
    setRemovingId(category.id);
    try {
      await api.delete(`/content-categories/${category.id}`);
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not remove this category.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <Tags size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">Content category</h2>
            <p className="text-sm text-gray-500">The niche list offered on a creator's optional Category field.</p>
          </div>
        </div>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-600">Admin only</span>
      </div>

      <div className="my-4 border-t border-gray-100" />

      <div className="rounded-card border border-[#e7e5e4] bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">Add a category</h3>
        <p className="mb-3 mt-0.5 text-xs text-gray-500">Duplicate names are blocked automatically.</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="e.g. Gaming"
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={!name.trim() || adding}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add category"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-ink">Available categories</h3>
        <p className="mb-3 mt-0.5 text-xs text-gray-500">{categories.length} categories</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-2 rounded-full border border-[#e7e5e4] bg-white px-3 py-1.5 text-sm text-ink"
            >
              {c.name}
              <button
                onClick={() => handleRemove(c)}
                disabled={removingId === c.id}
                title={`Remove ${c.name}`}
                className="text-xs font-semibold text-gray-400 hover:text-[#cf4e43] disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))}
          {categories.length === 0 && <p className="text-sm text-gray-400">No categories yet.</p>}
        </div>
      </div>
    </div>
  );
}
