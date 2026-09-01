import { AlertTriangle, Check, ShieldCheck, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { COLLAB_STAGE_ORDER } from "../../lib/collab-stages";
import { initials, instagramUrl } from "../../lib/format";
import type { Collaboration, CollabStage, ContentType, DealType, PaymentStatus, Product } from "../../lib/types";
import { RequestApprovalModal } from "./RequestApprovalModal";

const STAGE_LABEL: Record<CollabStage, string> = Object.fromEntries(
  COLLAB_STAGE_ORDER.map((s) => [s.key, s.label])
) as Record<CollabStage, string>;

const PRIORITIES = [
  { label: "High", value: "priority" },
  { label: "Medium", value: "active" },
  { label: "Low", value: "none" },
];

const PAYMENT_OPTIONS: { label: string; value: PaymentStatus }[] = [
  { label: "Payment Done", value: "payment_done" },
  { label: "Partial Payment", value: "partial_payment" },
  { label: "Pending", value: "pending" },
];

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  creator_reply: "Creator reply",
  commercial_quoted: "Commercial quoted",
  commercial_amount: "Commercial locked amount",
  deal_type: "Deal type (Paid/Barter)",
  content_type: "Content type (Integrated/Dedicated)",
  live_attribution: "Live video attribution",
  creator_phone: "Phone / WhatsApp",
};

function toggleId(list: number[], setList: (v: number[]) => void, id: number) {
  setList(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
}

export function CollabDetailPanel({
  collab,
  products,
  onClose,
  onChanged,
}: {
  collab: Collaboration;
  products: Product[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const primaryProductId = collab.products.find((p) => p.is_primary)?.product_id ?? null;

  const [priority, setPriority] = useState(collab.priority);
  const [creatorReply, setCreatorReply] = useState(collab.creator_reply ?? "");
  const [commercialQuoted, setCommercialQuoted] = useState(collab.commercial_quoted?.toString() ?? "");
  const [counterQuoteAgent, setCounterQuoteAgent] = useState(collab.counter_quote_agent?.toString() ?? "");
  const [counterQuoteCreator, setCounterQuoteCreator] = useState(collab.counter_quote_creator?.toString() ?? "");
  const [commercialAmount, setCommercialAmount] = useState(collab.commercial_amount?.toString() ?? "");
  const [dealType, setDealType] = useState<DealType | "">(collab.deal_type ?? "");
  const [contentType, setContentType] = useState<ContentType | "">(collab.content_type ?? "");
  const [trackingLink, setTrackingLink] = useState(collab.tracking_link ?? "");
  const [orderId, setOrderId] = useState(collab.order_id ?? "");
  const [pocCode, setPocCode] = useState(collab.poc_code ?? "");
  const [videoLink, setVideoLink] = useState(collab.video_link ?? "");
  const [videoLiveDate, setVideoLiveDate] = useState(collab.video_live_date ?? "");
  const [additionalProductIds, setAdditionalProductIds] = useState<number[]>(
    collab.products.filter((p) => !p.is_primary).map((p) => p.product_id)
  );
  const [liveAttributionProductIds, setLiveAttributionProductIds] = useState<number[]>(
    collab.products.filter((p) => p.is_live_attributed).map((p) => p.product_id)
  );
  const [productVariants, setProductVariants] = useState<Record<number, number>>(
    Object.fromEntries(collab.products.filter((p) => p.variant_id != null).map((p) => [p.product_id, p.variant_id!]))
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(collab.payment_status);
  const [note, setNote] = useState(collab.note ?? "");
  const [creatorPhone, setCreatorPhone] = useState("");
  const [creatorAlternatePhone, setCreatorAlternatePhone] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");

  useEffect(() => {
    api.get(`/creators/${collab.creator_id}`).then((res) => {
      setCreatorPhone(res.data.phone ?? "");
      setCreatorAlternatePhone(res.data.alternate_phone ?? "");
      setCreatorEmail(res.data.email ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collab.creator_id]);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [showApproval, setShowApproval] = useState(false);
  const [movingStage, setMovingStage] = useState(false);
  const [targetStage, setTargetStage] = useState<CollabStage | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [markingDead, setMarkingDead] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const linkedProductIds = useMemo(
    () => [...(primaryProductId ? [primaryProductId] : []), ...additionalProductIds],
    [primaryProductId, additionalProductIds]
  );

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/collaborations/${collab.id}`, {
        priority,
        creator_reply: creatorReply || null,
        commercial_quoted: commercialQuoted ? Number(commercialQuoted) : null,
        counter_quote_agent: counterQuoteAgent ? Number(counterQuoteAgent) : null,
        counter_quote_creator: counterQuoteCreator ? Number(counterQuoteCreator) : null,
        commercial_amount: commercialAmount ? Number(commercialAmount) : null,
        deal_type: dealType || null,
        content_type: contentType || null,
        tracking_link: trackingLink || null,
        order_id: orderId || null,
        poc_code: pocCode || null,
        video_link: videoLink || null,
        video_live_date: videoLiveDate || null,
        payment_status: paymentStatus,
        note: note || null,
        additional_product_ids: additionalProductIds,
        live_attribution_product_ids: liveAttributionProductIds,
        product_variants: Object.fromEntries(
          Object.entries(productVariants).filter(([pid]) => linkedProductIds.includes(Number(pid)))
        ),
      });
      await api.patch(`/creators/${collab.creator_id}`, {
        phone: creatorPhone || null,
        alternate_phone: creatorAlternatePhone || null,
        email: creatorEmail || null,
      });
      onChanged();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not save changes. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function moveToStage(stage: CollabStage) {
    setError(null);
    setMovingStage(true);
    try {
      await api.post(`/collaborations/${collab.id}/stage`, {
        to_stage: stage,
        creator_phone: creatorPhone || undefined,
        creator_email: creatorEmail || undefined,
      });
      onChanged();
      onClose();
    } catch (err: any) {
      const missingFields: string[] | undefined = err.response?.data?.detail?.missing_fields;
      if (err.response?.status === 400 && Array.isArray(missingFields)) {
        const labels = missingFields.map((f) => REQUIRED_FIELD_LABELS[f] ?? f).join(", ");
        setError(`Fill in ${labels} above, click Save fields, then try Move stage again.`);
      } else {
        setError(err.response?.data?.detail ?? "Could not move this card.");
      }
    } finally {
      setMovingStage(false);
    }
  }

  async function markDead() {
    setMarkingDead(true);
    try {
      await api.post(`/collaborations/${collab.id}/stage`, { to_stage: "dead_leads" });
      onChanged();
      onClose();
    } finally {
      setMarkingDead(false);
    }
  }

  async function deleteCollaboration() {
    setDeleting(true);
    try {
      await api.delete(`/collaborations/${collab.id}`);
      onChanged();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  const isDead = collab.stage === "dead_leads";

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-full w-[600px] flex-col bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">
              {initials(collab.creator_name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-ink">{collab.creator_name}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                  {collab.collab_code}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                <a
                  href={instagramUrl(collab.creator_handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-brand-600 hover:underline"
                >
                  @{collab.creator_handle}
                </a>{" "}
                · {collab.creator_total_collabs} collaboration
                {collab.creator_total_collabs !== 1 ? "s" : ""} · {collab.creator_videos_live} video
                {collab.creator_videos_live !== 1 ? "s" : ""} live
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#e7e5e4] px-5 py-3 text-xs">
          <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-semibold text-brand-600">
            {STAGE_LABEL[collab.stage]}
          </span>
          <span className="rounded-lg border border-[#e7e5e4] px-2.5 py-1 text-gray-500">
            Owner: {collab.owner_name}
          </span>
          <span className="rounded-lg border border-[#e7e5e4] px-2.5 py-1 text-gray-500">
            Added {new Date(collab.created_at).toLocaleDateString("en-CA")}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <section className="mb-5">
            <h3 className="text-sm font-semibold text-ink">Creator and collaboration</h3>
            <p className="mt-0.5 text-xs text-muted">The username is the permanent link to the master creator record.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Instagram username</label>
                <input
                  disabled
                  value={`@${collab.creator_handle}`}
                  className="w-full rounded-md border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Collab ID</label>
                <input
                  disabled
                  value={collab.collab_code}
                  className="w-full rounded-md border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Current stage</label>
                <input
                  disabled
                  value={STAGE_LABEL[collab.stage]}
                  className="w-full rounded-md border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Phone / WhatsApp</label>
                <input
                  type="tel"
                  value={creatorPhone}
                  onChange={(e) => setCreatorPhone(e.target.value)}
                  placeholder="Not provided for this lead yet"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Alternate mobile number</label>
                <input
                  type="tel"
                  value={creatorAlternatePhone}
                  onChange={(e) => setCreatorAlternatePhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Email address</label>
                <input
                  type="email"
                  value={creatorEmail}
                  onChange={(e) => setCreatorEmail(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              Phone isn't required for a new lead — required once the creator has replied. Alternate number and
              email are always optional.
            </p>
          </section>

          <section className="mb-5 rounded-card border border-[#e7e5e4] p-3">
            <h3 className="text-sm font-semibold text-ink">Reply and commercials</h3>
            <p className="mt-0.5 text-xs text-muted">These fields unlock the early collaboration stages.</p>
            <label className="mb-1 mt-3 block text-xs font-medium text-gray-700">What did the creator reply?</label>
            <input
              value={creatorReply}
              onChange={(e) => setCreatorReply(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Commercial quote · From creator</label>
                <input
                  type="number"
                  min={0}
                  value={commercialQuoted}
                  onChange={(e) => setCommercialQuoted(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Counter quote · From agent</label>
                <input
                  type="number"
                  min={0}
                  value={counterQuoteAgent}
                  onChange={(e) => setCounterQuoteAgent(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Counter quote · From creator</label>
                <input
                  type="number"
                  min={0}
                  value={counterQuoteCreator}
                  onChange={(e) => setCounterQuoteCreator(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <label className="mb-1 mt-2 block text-[11px] text-gray-500">Commercial locked · Final approved</label>
            <input
              type="number"
              min={0}
              value={commercialAmount}
              onChange={(e) => setCommercialAmount(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Deal type</label>
                <select
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value as DealType)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="paid">Paid</option>
                  <option value="barter">Barter</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Content type</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as ContentType)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="integrated">Integrated</option>
                  <option value="dedicated">Dedicated</option>
                </select>
              </div>
            </div>
          </section>

          <section className="mb-5 rounded-card border border-[#e7e5e4] p-3">
            <h3 className="text-sm font-semibold text-ink">Product fulfilment</h3>
            <p className="mt-0.5 text-xs text-muted">Order details and every product included in the shipment.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Tracking link</label>
                <input
                  value={trackingLink}
                  onChange={(e) => setTrackingLink(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Order ID</label>
                <input
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <p className="mb-1 mt-2 text-[11px] text-gray-500">Products sent</p>
            <div className="grid grid-cols-2 gap-1">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={p.id === primaryProductId || additionalProductIds.includes(p.id)}
                    disabled={p.id === primaryProductId}
                    onChange={() => toggleId(additionalProductIds, setAdditionalProductIds, p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
            {linkedProductIds
              .map((pid) => products.find((p) => p.id === pid))
              .filter((p): p is Product => !!p && p.variants.length > 0)
              .map((p) => (
                <div key={p.id} className="mt-2">
                  <label className="mb-1 block text-[11px] text-gray-500">{p.name} · Shade</label>
                  <select
                    value={productVariants[p.id] ?? ""}
                    onChange={(e) =>
                      setProductVariants((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                    }
                    className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs"
                  >
                    <option value="">No shade selected</option>
                    {p.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </section>

          <section className="mb-5 rounded-card border border-[#e7e5e4] p-3">
            <h3 className="text-sm font-semibold text-ink">Live video attribution</h3>
            <p className="mt-0.5 text-xs text-muted">One live card equals one video. Product credit is divided equally.</p>
            <p className="mb-1 mt-2 text-[11px] text-gray-500">Products featured in the video</p>
            <div className="grid grid-cols-2 gap-1">
              {products
                .filter((p) => linkedProductIds.includes(p.id))
                .map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={liveAttributionProductIds.includes(p.id)}
                      onChange={() => toggleId(liveAttributionProductIds, setLiveAttributionProductIds, p.id)}
                    />
                    {p.name}
                  </label>
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">POC code</label>
                <input
                  value={pocCode}
                  onChange={(e) => setPocCode(e.target.value)}
                  placeholder="AN_Creator_1006"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Video / Reel link</label>
                <input
                  type="url"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder="https://instagram.com/reel/..."
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Video live date · Optional</label>
                <input
                  type="date"
                  value={videoLiveDate}
                  onChange={(e) => setVideoLiveDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Leave blank to use the date this card was moved to Live.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ink">Payment and working note</h3>
            <p className="mt-0.5 text-xs text-muted">
              The note is only a personal reminder and never affects stage movement.
            </p>
            <label className="mb-1 mt-3 block text-xs font-medium text-gray-700">Payment</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="mb-1 block text-xs font-medium text-gray-700">Working note / reminder</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional · does not unlock, block or change any stage."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </section>
        </div>

        <div className="border-t border-[#e7e5e4] p-4">
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          {targetStage !== "" && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-[#e7e5e4] bg-surface p-2">
              <select
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value as CollabStage)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              >
                <option value="">Choose a stage...</option>
                {COLLAB_STAGE_ORDER.filter((s) => s.key !== collab.stage).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!targetStage || movingStage}
                onClick={() => targetStage && moveToStage(targetStage)}
                className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Check size={12} />
                Confirm
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markDead}
                disabled={isDead || markingDead}
                className="flex items-center gap-1.5 rounded-lg border border-[#f5d3d0] px-3 py-2 text-xs font-semibold text-[#cf4e43] hover:bg-[#fff0ed] disabled:opacity-40"
              >
                <AlertTriangle size={13} />
                Mark Dead
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Admin only · permanently deletes this Collab ID"
                  className="flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-gray-400 hover:border-[#f5d3d0] hover:bg-[#fff0ed] hover:text-[#cf4e43]"
                >
                  <Trash2 size={13} />
                  Delete card
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowApproval(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#e7e5e4] px-3 py-2 text-xs font-semibold text-ink hover:bg-surface"
              >
                <ShieldCheck size={13} />
                Send for approval
              </button>
              <button
                type="button"
                onClick={() => setTargetStage((v) => (v === "" ? COLLAB_STAGE_ORDER[0].key : ""))}
                disabled={isDead && !isAdmin}
                title={isDead && !isAdmin ? "Only an admin can move a card out of Dead Leads" : undefined}
                className="rounded-lg border border-[#e7e5e4] px-3 py-2 text-xs font-semibold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                Move stage
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Check size={13} />
                {saving ? "Saving..." : "Save fields"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {showApproval && (
        <RequestApprovalModal collab={collab} onClose={() => setShowApproval(false)} onSent={() => {}} />
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-[380px] rounded-card bg-white p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-ink">Delete {collab.collab_code}?</h3>
            <p className="mt-1.5 text-xs text-muted">
              This permanently deletes only this Collab ID. {collab.creator_name} and any other collaboration
              cards for them are not affected. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteCollaboration}
                disabled={deleting}
                className="rounded-md bg-[#cf4e43] px-4 py-2 text-sm font-medium text-white hover:bg-[#b8362b] disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete card"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
