import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { COLLAB_STAGE_ORDER } from "../../lib/collab-stages";
import type { CollabStage, ContentBucket, ContentType, DealType, Language, Platform } from "../../lib/types";

interface VideoLinkRow {
  platform: Platform | "";
  url: string;
}

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
  const [trackingLink, setTrackingLink] = useState("");
  const [orderId, setOrderId] = useState("");
  const [pocCode, setPocCode] = useState("");
  const [videoLinks, setVideoLinks] = useState<VideoLinkRow[]>([{ platform: "", url: "" }]);
  const [language, setLanguage] = useState("");
  const [contentBucket, setContentBucket] = useState("");
  const [languages, setLanguages] = useState<Language[]>([]);
  const [contentBuckets, setContentBuckets] = useState<ContentBucket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetLabel = COLLAB_STAGE_ORDER.find((s) => s.key === targetStage)?.label ?? targetStage;

  useEffect(() => {
    if (missingFields.includes("language")) {
      api.get<Language[]>("/languages").then((res) => setLanguages(res.data));
    }
    if (missingFields.includes("content_bucket")) {
      api.get<ContentBucket[]>("/content-buckets").then((res) => setContentBuckets(res.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateVideoLink(index: number, patch: Partial<VideoLinkRow>) {
    setVideoLinks((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addVideoLink() {
    setVideoLinks((prev) => [...prev, { platform: "", url: "" }]);
  }

  function removeVideoLink(index: number) {
    setVideoLinks((prev) => prev.filter((_, i) => i !== index));
  }

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
    if (missingFields.includes("tracking_link") && !trackingLink.trim()) {
      setError("Tracking link is required.");
      return;
    }
    if (missingFields.includes("order_id") && !orderId.trim()) {
      setError("Order ID is required.");
      return;
    }
    if (missingFields.includes("poc_code") && !pocCode.trim()) {
      setError("POC code is required.");
      return;
    }
    if (missingFields.includes("video_link") && (!videoLinks[0].url.trim() || !videoLinks[0].platform)) {
      setError("The first video link and its platform are required.");
      return;
    }
    if (videoLinks.some((row, i) => i > 0 && row.url.trim() && !row.platform)) {
      setError("Choose a platform for every video link you've added.");
      return;
    }
    if (missingFields.includes("language") && !language) {
      setError("Select a language.");
      return;
    }
    if (missingFields.includes("content_bucket") && !contentBucket) {
      setError("Select a content bucket.");
      return;
    }
    setSubmitting(true);
    try {
      const additionalLinks = videoLinks
        .slice(1)
        .filter((row) => row.url.trim() && row.platform)
        .map((row) => ({ platform: row.platform, url: row.url.trim() }));
      await api.post(`/collaborations/${collabId}/stage`, {
        to_stage: targetStage,
        creator_reply: missingFields.includes("creator_reply") ? creatorReply : undefined,
        commercial_quoted: missingFields.includes("commercial_quoted") ? Number(commercialQuoted) : undefined,
        commercial_amount: missingFields.includes("commercial_amount") ? Number(commercialAmount) : undefined,
        deal_type: missingFields.includes("deal_type") ? dealType : undefined,
        content_type: missingFields.includes("content_type") ? contentType : undefined,
        live_attribution_product_ids: missingFields.includes("live_attribution") ? liveAttributionIds : undefined,
        creator_phone: missingFields.includes("creator_phone") ? creatorPhone : undefined,
        tracking_link: missingFields.includes("tracking_link") ? trackingLink : undefined,
        order_id: missingFields.includes("order_id") ? orderId : undefined,
        poc_code: missingFields.includes("poc_code") ? pocCode : undefined,
        video_link: missingFields.includes("video_link") ? videoLinks[0].url.trim() : undefined,
        platform: missingFields.includes("video_link") ? videoLinks[0].platform : undefined,
        additional_video_links: additionalLinks.length > 0 ? additionalLinks : undefined,
        language: missingFields.includes("language") ? language : undefined,
        content_bucket: missingFields.includes("content_bucket") ? contentBucket : undefined,
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
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-[480px] overflow-y-auto rounded-card bg-white p-5 shadow-lg"
      >
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
          {missingFields.includes("tracking_link") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Tracking link · Required</label>
              <input
                value={trackingLink}
                onChange={(e) => setTrackingLink(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          {missingFields.includes("order_id") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Order ID · Required</label>
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          {missingFields.includes("poc_code") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">POC code · Required</label>
              <input
                value={pocCode}
                onChange={(e) => setPocCode(e.target.value)}
                placeholder="AN_Creator_1006"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          {missingFields.includes("video_link") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Video / Reel link · Required
              </label>
              <p className="mb-1.5 text-[11px] text-gray-400">
                Add one link per platform the video went live on -- e.g. an Instagram Reel and a YouTube upload.
              </p>
              <div className="flex flex-col gap-1.5">
                {videoLinks.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <select
                      value={row.platform}
                      onChange={(e) => updateVideoLink(i, { platform: e.target.value as Platform })}
                      className="w-[110px] shrink-0 rounded-md border border-gray-300 px-2 py-2 text-sm"
                    >
                      <option value="">Platform</option>
                      <option value="instagram">Instagram</option>
                      <option value="youtube">YouTube</option>
                    </select>
                    <input
                      value={row.url}
                      onChange={(e) => updateVideoLink(i, { url: e.target.value })}
                      placeholder="https://instagram.com/reel/..."
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => removeVideoLink(i)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-surface hover:text-red-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addVideoLink}
                className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <Plus size={12} /> Add another link
              </button>
            </div>
          )}
          {missingFields.includes("language") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Language · Required</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {languages.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {missingFields.includes("content_bucket") && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Content bucket · Required</label>
              <select
                value={contentBucket}
                onChange={(e) => setContentBucket(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {contentBuckets.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
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
