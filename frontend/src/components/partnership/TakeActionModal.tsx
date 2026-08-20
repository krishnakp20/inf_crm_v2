import { X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../../lib/api";
import { COLLAB_STATUS_OPTIONS } from "../../lib/partnership-stages";
import type { PartnershipCollabStatus } from "../../lib/types";

export function TakeActionModal({
  ticketIds,
  videoName,
  ownerName,
  onClose,
  onDone,
}: {
  ticketIds: number[];
  videoName?: string;
  ownerName?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [adRights, setAdRights] = useState(false);
  const [adCode, setAdCode] = useState(false);
  const [ctaLink, setCtaLink] = useState(false);
  const [collabStatus, setCollabStatus] = useState<PartnershipCollabStatus>("open");
  const [dueDate, setDueDate] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isBulk = ticketIds.length > 1;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!adRights && !adCode && !ctaLink) {
      setError("Choose at least one actionable field.");
      return;
    }
    if (!remark.trim()) {
      setError("A remark is required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        requested_ad_rights: adRights,
        requested_ad_code: adCode,
        requested_cta_link: ctaLink,
        collab_status: collabStatus,
        response_due_at: dueDate || null,
        remark,
      };
      if (isBulk) {
        await api.post("/partnership/take-action/bulk", { ...payload, ticket_ids: ticketIds });
      } else {
        await api.post(`/partnership/${ticketIds[0]}/take-action`, payload);
      }
      onDone();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not send this request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-[440px] rounded-card bg-white p-5 shadow-lg"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Take action</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          {isBulk ? `${ticketIds.length} videos selected` : `${videoName ?? ""} · Owner ${ownerName ?? ""}`}
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">Request action</label>
        <p className="mb-2 text-xs text-gray-400">Choose one or more actionable fields for this ticket.</p>
        <div className="mb-3 flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={adRights} onChange={(e) => setAdRights(e.target.checked)} />
            Ad rights
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={adCode} onChange={(e) => setAdCode(e.target.checked)} />
            Ad code
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={ctaLink} onChange={(e) => setCtaLink(e.target.checked)} />
            CTA link
          </label>
        </div>
        {adRights && (
          <p className="mb-3 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
            Ad-right requests automatically include creator commercial negotiation.
          </p>
        )}

        <label className="mb-1 block text-sm font-medium text-gray-700">Collab status</label>
        <select
          value={collabStatus}
          onChange={(e) => setCollabStatus(e.target.value as PartnershipCollabStatus)}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {COLLAB_STATUS_OPTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-sm font-medium text-gray-700">Response due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">Remark for Agent · Required</label>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={3}
          placeholder="Explain the request clearly. This becomes the first timeline entry..."
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />

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
            {submitting ? "Sending..." : ownerName ? `Send to ${ownerName} →` : "Send →"}
          </button>
        </div>
      </form>
    </div>
  );
}
