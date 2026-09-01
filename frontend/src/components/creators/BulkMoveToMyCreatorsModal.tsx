import { X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../../lib/api";
import { COLLAB_STAGE_ORDER, STARTABLE_COLLAB_STAGES } from "../../lib/collab-stages";
import type { CollabStage, ContentType, DealType, Product } from "../../lib/types";

const STAGE_INDEX: Record<CollabStage, number> = Object.fromEntries(
  COLLAB_STAGE_ORDER.map((s, i) => [s.key, i])
) as Record<CollabStage, number>;
const REPLIED_IDX = STAGE_INDEX.replied;
const NEGOTIATING_IDX = STAGE_INDEX.negotiating;
const LOCKED_IDX = STAGE_INDEX.commercial_locked;

const PRIORITIES = [
  { label: "High", value: "priority" },
  { label: "Medium", value: "active" },
  { label: "Low", value: "none" },
];

export function BulkMoveToMyCreatorsModal({
  creatorIds,
  products,
  onClose,
  onDone,
}: {
  creatorIds: number[];
  products: Product[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<CollabStage>(STARTABLE_COLLAB_STAGES[0].key);
  const [productId, setProductId] = useState<number | "">(products[0]?.id ?? "");
  const [priority, setPriority] = useState("active");
  const [creatorReply, setCreatorReply] = useState("");
  const [commercialQuoted, setCommercialQuoted] = useState("");
  const [dealType, setDealType] = useState<DealType | "">("");
  const [commercialAmount, setCommercialAmount] = useState("");
  const [contentType, setContentType] = useState<ContentType | "">("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number; total: number } | null>(null);

  const stageIdx = STAGE_INDEX[stage];
  const showReply = stageIdx >= REPLIED_IDX;
  const showNegotiation = stageIdx >= NEGOTIATING_IDX;
  const showLocked = stageIdx >= LOCKED_IDX;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!productId) {
      setError("Choose a primary product.");
      return;
    }
    if (showReply && !creatorReply.trim()) {
      setError("Creator reply is required for this stage.");
      return;
    }
    if (showNegotiation && (!commercialQuoted || !dealType)) {
      setError("Commercial quoted and deal type are required for this stage.");
      return;
    }
    if (showLocked && (!commercialAmount || !contentType)) {
      setError("Commercial locked amount and content type are required for this stage.");
      return;
    }

    setSubmitting(true);
    const payload = {
      primary_product_id: productId,
      priority,
      stage,
      creator_reply: showReply ? creatorReply : null,
      commercial_quoted: showNegotiation && commercialQuoted ? Number(commercialQuoted) : null,
      deal_type: showNegotiation && dealType ? dealType : null,
      commercial_amount: showLocked && commercialAmount ? Number(commercialAmount) : null,
      content_type: showLocked && contentType ? contentType : null,
      live_attribution_product_ids: stage === "live" ? [productId] : [],
    };

    let created = 0;
    let failed = 0;
    for (const creatorId of creatorIds) {
      try {
        await api.post("/collaborations", { ...payload, creator_id: creatorId });
        created += 1;
      } catch {
        failed += 1;
      }
    }
    setSubmitting(false);
    setResult({ created, failed, total: creatorIds.length });
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="w-[400px] rounded-card bg-white p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-ink">Moved to My Creators</h3>
          <p className="mt-1.5 text-xs text-muted">
            {result.created} of {result.total} creator{result.total !== 1 ? "s" : ""} moved to{" "}
            {COLLAB_STAGE_ORDER.find((s) => s.key === stage)?.label}.
            {result.failed > 0 &&
              ` ${result.failed} failed — they may already have a card in this exact state, or the primary product doesn't fit their existing links.`}
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onDone();
                onClose();
              }}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-full w-[480px] flex-col bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Move to My Creators</h2>
            <p className="text-xs text-gray-500">
              Creates a new Collab ID for {creatorIds.length} selected creator{creatorIds.length !== 1 ? "s" : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label className="mb-1 block text-sm font-medium text-gray-700">Move to stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as CollabStage)}
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {STARTABLE_COLLAB_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-sm font-medium text-gray-700">Primary product</label>
          <select
            value={productId}
            onChange={(e) => setProductId(Number(e.target.value))}
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <p className="mb-3 text-[11px] text-gray-400">
            Applied to every selected creator the same way — fill in what this stage needs below. Anything
            creator-specific (video link, exact quote, etc.) can still be edited per-card afterward.
          </p>

          {showReply && (
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">Creator reply · Required</label>
              <input
                value={creatorReply}
                onChange={(e) => setCreatorReply(e.target.value)}
                placeholder="What did the creator reply?"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {showNegotiation && (
            <div className="mb-3 rounded-md border border-gray-200 p-3">
              <p className="mb-2 text-xs font-semibold text-ink">Commercial negotiation</p>
              <label className="mb-1 block text-sm font-medium text-gray-700">Commercial quoted · Required</label>
              <input
                type="number"
                min={0}
                value={commercialQuoted}
                onChange={(e) => setCommercialQuoted(e.target.value)}
                placeholder="₹18,000"
                className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Deal type · Required</label>
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

          {showLocked && (
            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">Commercial locked · Required</label>
              <input
                type="number"
                min={0}
                value={commercialAmount}
                onChange={(e) => setCommercialAmount(e.target.value)}
                placeholder="₹13,000"
                className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Content type · Required</label>
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
        </div>

        <div className="border-t border-[#e7e5e4] p-4">
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
              {submitting ? "Moving..." : `Move ${creatorIds.length} to My Creators`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
