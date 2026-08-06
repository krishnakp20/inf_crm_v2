import { Plus, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../../lib/api";
import type { CreatorStage, User } from "../../lib/types";

export function AddCreatorModal({
  users,
  currentUserId,
  isAdmin,
  defaultOwnerId,
  initialStage,
  onClose,
  onCreated,
}: {
  users: User[];
  currentUserId: number;
  isAdmin: boolean;
  defaultOwnerId?: number;
  initialStage?: CreatorStage;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerId, setOwnerId] = useState(
    defaultOwnerId ?? (isAdmin ? users[0]?.id ?? currentUserId : currentUserId)
  );
  const [category, setCategory] = useState("");
  const [followersCount, setFollowersCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ownershipWarning, setOwnershipWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ownerName = (ownerIdToFind: number) =>
    users.find((u) => u.id === ownerIdToFind)?.name ?? "another advisor";

  const canSubmit = name.trim() && handle.trim() && (!isAdmin || ownerId);

  async function checkHandleOwnership() {
    const cleanHandle = handle.replace(/^@/, "").trim();
    if (!cleanHandle) {
      setOwnershipWarning(null);
      return;
    }
    const { data } = await api.get("/creators/check-ownership", { params: { query: cleanHandle } });
    const exactMatch = data.find(
      (m: { instagram_handle: string }) => m.instagram_handle.toLowerCase() === cleanHandle.toLowerCase()
    );
    if (exactMatch) {
      setOwnershipWarning(
        `@${exactMatch.instagram_handle} is already owned by ${ownerName(exactMatch.owner_id)} (${exactMatch.current_stage.replace(/_/g, " ")}).`
      );
    } else {
      setOwnershipWarning(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data: created } = await api.post("/creators", {
        name,
        instagram_handle: handle.replace(/^@/, ""),
        phone: phone || null,
        followers_count: followersCount ? Number(followersCount) : 0,
        category: category || "Beauty",
        owner_id: isAdmin ? ownerId : currentUserId,
      });
      if (initialStage && initialStage !== "new_lead") {
        await api.post(`/creators/${created.id}/stage`, { to_stage: initialStage });
      }
      onCreated();
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409) {
        await checkHandleOwnership();
        setError(`@${handle.replace(/^@/, "")} is already in the database.`);
      } else {
        setError("Could not add creator. Check the fields and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-full w-[480px] flex-col bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Plus size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Add creator</h2>
              <p className="text-xs text-gray-500">Every username is checked against the complete database first.</p>
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

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-start gap-2.5 rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <div>
              <div className="text-xs font-semibold text-ink">Lead-clash protection is active</div>
              <div className="mt-0.5 text-xs text-gray-500">
                An existing creator cannot be added by another user. The current owner and stage will be shown below.
              </div>
            </div>
          </div>

          <label className="mb-1 block text-sm font-medium text-gray-700">Instagram username · Required</label>
          <input
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setOwnershipWarning(null);
            }}
            onBlur={checkHandleOwnership}
            placeholder="@username"
            className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {ownershipWarning && (
            <p className="mb-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700">
              {ownershipWarning}
            </p>
          )}
          {!ownershipWarning && <div className="mb-3" />}

          <label className="mb-1 block text-sm font-medium text-gray-700">Creator name · Required</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Mobile number · Optional</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="-mt-2 mb-3 text-[11px] text-gray-400">
            Not required for a new lead — will be asked for once the creator replies.
          </p>

          {isAdmin && (
            <>
              <label className="mb-1 block text-sm font-medium text-gray-700">Assigned to · Required</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(Number(e.target.value))}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className="mb-1 block text-sm font-medium text-gray-700">Category · Optional</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Beauty"
            className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Followers · Optional</label>
          <input
            type="number"
            min={0}
            value={followersCount}
            onChange={(e) => setFollowersCount(e.target.value)}
            placeholder="85000"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-[#e7e5e4] p-4">
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
              disabled={!canSubmit || submitting}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Plus size={14} />
              {submitting ? "Adding..." : "Add creator"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
