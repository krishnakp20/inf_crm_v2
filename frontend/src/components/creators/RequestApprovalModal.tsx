import { FormEvent, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import type { ApprovalPriority, ApprovalTarget, Collaboration } from "../../lib/types";

export function RequestApprovalModal({
  collab,
  onClose,
  onSent,
}: {
  collab: Collaboration;
  onClose: () => void;
  onSent: () => void;
}) {
  const { user } = useAuth();
  const hasSupervisor = user?.supervisor_id != null;
  const primaryProductName = collab.products.find((p) => p.is_primary)?.product_name ?? collab.products[0]?.product_name;
  const [priority, setPriority] = useState<ApprovalPriority>("normal");
  const [target, setTarget] = useState<ApprovalTarget>("admin");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setError("Add a note explaining what needs approval.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/approval-requests", {
        collaboration_id: collab.id,
        priority,
        note,
        target,
      });
      onSent();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not send approval request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto my-8 max-h-[calc(100vh-4rem)] w-full max-w-md overflow-y-auto dashboard-card p-6 shadow-lg"
      >
        <h2 className="mb-1 text-base font-semibold text-ink">Request approval</h2>
        <p className="mb-4 text-sm text-gray-500">
          {collab.creator_name} · {primaryProductName} · {collab.collab_code}
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">Send to</label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as ApprovalTarget)}
          className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="admin">Admin</option>
          <option value="supervisor" disabled={!hasSupervisor}>
            My supervisor{!hasSupervisor ? " (none assigned)" : ""}
          </option>
        </select>
        <p className="-mt-1 mb-3 text-[11px] text-gray-400">
          {target === "supervisor"
            ? "Only your supervisor will see and act on this request."
            : "Admin will see and act on this request."}
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as ApprovalPriority)}
          className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>

        <label className="mb-1 block text-sm font-medium text-gray-700">What needs approval?</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Creator quoted a higher commercial, please approve before I lock it."
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
            {submitting ? "Sending..." : "Send request"}
          </button>
        </div>
      </form>
    </div>
  );
}
