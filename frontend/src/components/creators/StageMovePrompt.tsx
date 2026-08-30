import { useState } from "react";
import { api } from "../../lib/api";
import { COLLAB_STAGE_ORDER } from "../../lib/collab-stages";
import type { CollabStage, ContentType, DealType } from "../../lib/types";

export function StageMovePrompt({
  collabId,
  targetStage,
  missingFields,
  linkedProducts,
  onClose,
  onMoved,
}: {
  collabId: number;
  targetStage: CollabStage;
  missingFields: string[];
  linkedProducts: { id: number; name: string }[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [creatorReply, setCreatorReply] = useState("");
  const [commercialQuoted, setCommercialQuoted] = useState("");
  const [commercialAmount, setCommercialAmount] = useState("");
  const [dealType, setDealType] = useState<DealType | "">("");
  const [contentType, setContentType] = useState<ContentType | "">("");
  const [liveAttributionIds, setLiveAttributionIds] = useState<number[]>([]);
  const [creatorPhone, setCreatorPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetLabel = COLLAB_STAGE_ORDER.find((s) => s.key === targetStage)?.label ?? targetStage;

  async function handleSubmit() {
    setError(null);
    if (missingFields.includes("creator_reply") && !creatorReply.trim()) {
      setError("Creator reply is required.");
      return;
    }
    if (missingFields.includes("commercial_quoted") && !commercialQuoted) {
      setError("Commercial quoted is required.");
      return;
    }
    if (missingFields.includes("commercial_amount") && !commercialAmount) {
      setError("Commercial locked amount is required.");
      return;
    }
    if (missingFields.includes("deal_type") && !dealType) {
      setError("Select a deal type.");
      return;
    }
    if (missingFields.includes("content_type") && !contentType) {
      setError("Select a content type.");
      return;
    }
    if (missingFields.includes("live_attribution") && liveAttributionIds.length === 0) {
      setError("Select every product featured in this video.");
      return;
    }
    if (missingFields.includes("creator_phone") && !creatorPhone.trim()) {
      setError("Phone / WhatsApp is required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/collaborations/${collabId}/stage`, {
        to_stage: targetStage,
        creator_reply: missingFields.includes("creator_reply") ? creatorReply : undefined,
        commercial_quoted: missingFields.includes("commercial_quoted") ? Number(commercialQuoted) : undefined,
        commercial_amount: missingFields.includes("commercial_amount") ? Number(commercialAmount) : undefined,
        deal_type: missingFields.includes("deal_type") ? dealType : undefined,
        content_type: missingFields.includes("content_type") ? contentType : undefined,
        live_attribution_product_ids: missingFields.includes("live_attribution") ? liveAttributionIds : undefined,
        creator_phone: missingFields.includes("creator_phone") ? creatorPhone : undefined,
      });
      onMoved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail?.message ?? "Could not move this card. Check the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[420px] rounded-card bg-white p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-ink">Move to {targetLabel}</h3>
        <p className="mt-1 text-xs text-muted">This stage needs a few more details before the card can move.</p>

        <div className="mt-4 flex flex-col gap-3">
          {missingFields.includes("creator_reply") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Creator reply · Required</label>
              <input
                autoFocus
                value={creatorReply}
                onChange={(e) => setCreatorReply(e.target.value)}
                placeholder="What did the creator reply?"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          {missingFields.includes("creator_phone") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Phone / WhatsApp · Required</label>
              <input
                type="tel"
                value={creatorPhone}
                onChange={(e) => setCreatorPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          {missingFields.includes("commercial_quoted") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Commercial quoted · Required</label>
              <input
                type="number"
                min={0}
                value={commercialQuoted}
                onChange={(e) => setCommercialQuoted(e.target.value)}
                placeholder="₹18,000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          {missingFields.includes("commercial_amount") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Commercial locked amount · Required
              </label>
              <input
                type="number"
                min={0}
                value={commercialAmount}
                onChange={(e) => setCommercialAmount(e.target.value)}
                placeholder="₹13,000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          {missingFields.includes("deal_type") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Deal type · Required</label>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value as DealType)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                <option value="paid">Paid</option>
                <option value="barter">Barter</option>
              </select>
            </div>
          )}
          {missingFields.includes("content_type") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Content type · Required</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                <option value="integrated">Integrated</option>
                <option value="dedicated">Dedicated</option>
              </select>
            </div>
          )}
          {missingFields.includes("live_attribution") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Products featured in the video · Required
              </label>
              <div className="grid grid-cols-2 gap-1">
                {linkedProducts.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={liveAttributionIds.includes(p.id)}
                      onChange={() =>
                        setLiveAttributionIds((prev) =>
                          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        )
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Moving..." : "Move card"}
          </button>
        </div>
      </div>
    </div>
  );
}
