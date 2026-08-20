import { FormEvent, useState } from "react";
import { api } from "../../lib/api";
import { PLATFORM_OPTIONS } from "../../lib/campaign-stages";
import type { Platform } from "../../lib/types";

export function AddVideoModal({
  campaignId,
  onClose,
  onLinked,
}: {
  campaignId: number;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [collabCode, setCollabCode] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!collabCode.trim()) {
      setError("Enter a Collab ID.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/campaigns/${campaignId}/videos`, { collab_code: collabCode.trim(), platform });
      onLinked();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not link this video.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-96 rounded-card bg-white p-5 shadow-lg"
      >
        <h2 className="mb-1 text-base font-semibold text-ink">Add video</h2>
        <p className="mb-4 text-xs text-gray-500">Enter the Collab ID of an already-Live collaboration to link it here.</p>

        <label className="mb-1 block text-sm font-medium text-gray-700">Collab ID</label>
        <input
          value={collabCode}
          onChange={(e) => setCollabCode(e.target.value)}
          placeholder="CLB-2026-0040"
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">Platform</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Linking..." : "Link video"}
          </button>
        </div>
      </form>
    </div>
  );
}
