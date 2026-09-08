import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { CreatorCategoryTier } from "../../lib/types";

function formatFollowers(n: number): string {
  return n.toLocaleString();
}

function findTier(tiers: CreatorCategoryTier[], followers: number): CreatorCategoryTier | null {
  return (
    tiers.find((t) => followers >= t.min_followers && (t.max_followers === null || followers <= t.max_followers)) ??
    null
  );
}

export function CreatorCategoryPanel() {
  const [tiers, setTiers] = useState<CreatorCategoryTier[]>([]);
  const [name, setName] = useState("");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFollowers, setPreviewFollowers] = useState("");

  function loadTiers() {
    api.get<CreatorCategoryTier[]>("/creator-category-tiers").then((res) => setTiers(res.data));
  }

  useEffect(loadTiers, []);

  async function handleAdd() {
    if (!name.trim() || !minFollowers) return;
    setError(null);
    setAdding(true);
    try {
      await api.post("/creator-category-tiers", {
        name: name.trim(),
        min_followers: Number(minFollowers),
        max_followers: maxFollowers ? Number(maxFollowers) : null,
      });
      setName("");
      setMinFollowers("");
      setMaxFollowers("");
      loadTiers();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not add this category.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(tier: CreatorCategoryTier) {
    if (!confirm(`Remove "${tier.name}" from the creator category list?`)) return;
    setError(null);
    setRemovingId(tier.id);
    try {
      await api.delete(`/creator-category-tiers/${tier.id}`);
      loadTiers();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not remove this category.");
    } finally {
      setRemovingId(null);
    }
  }

  const previewTier = previewFollowers ? findTier(tiers, Number(previewFollowers)) : null;

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <Users size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">Creator category</h2>
            <p className="text-sm text-gray-500">
              Classify creators by follower count -- separate from the free-text Category field used elsewhere.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-600">Admin only</span>
      </div>

      <div className="my-4 border-t border-gray-100" />

      <div className="rounded-card border border-[#e7e5e4] bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">Add a category</h3>
        <p className="mb-3 mt-0.5 text-xs text-gray-500">
          Leave the maximum blank for an open-ended top tier (e.g. "500,000+").
        </p>
        <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Nano"
          className="mb-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Min followers</label>
            <input
              type="number"
              min={0}
              value={minFollowers}
              onChange={(e) => setMinFollowers(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Max followers · Optional</label>
            <input
              type="number"
              min={0}
              value={maxFollowers}
              onChange={(e) => setMaxFollowers(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={!name.trim() || !minFollowers || adding}
          className="mt-3 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add category"}
        </button>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-ink">Categories</h3>
        <p className="mb-3 mt-0.5 text-xs text-gray-500">{tiers.length} categories, sorted by follower count</p>
        <div className="flex flex-col gap-1.5">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-card border border-[#e7e5e4] bg-white px-3 py-2 text-sm"
            >
              <div>
                <span className="font-semibold text-ink">{t.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {formatFollowers(t.min_followers)} – {t.max_followers !== null ? formatFollowers(t.max_followers) : "+"}
                </span>
              </div>
              <button
                onClick={() => handleRemove(t)}
                disabled={removingId === t.id}
                title={`Remove ${t.name}`}
                className="text-xs font-semibold text-gray-400 hover:text-[#cf4e43] disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
          {tiers.length === 0 && <p className="text-sm text-gray-400">No categories yet.</p>}
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="mt-5 rounded-card border border-[#e7e5e4] bg-surface p-4">
          <h3 className="text-sm font-semibold text-ink">Preview</h3>
          <p className="mb-2 mt-0.5 text-xs text-gray-500">Test a follower count against your categories.</p>
          <input
            type="number"
            min={0}
            value={previewFollowers}
            onChange={(e) => setPreviewFollowers(e.target.value)}
            placeholder="e.g. 25000"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          {previewFollowers && (
            <p className="mt-2 text-sm">
              {previewTier ? (
                <>
                  Falls under <span className="font-semibold text-brand-600">{previewTier.name}</span>
                </>
              ) : (
                <span className="text-gray-400">No category covers this follower count.</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
