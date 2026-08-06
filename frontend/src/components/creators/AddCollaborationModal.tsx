import { X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { COLLAB_STAGE_ORDER, STARTABLE_COLLAB_STAGES } from "../../lib/collab-stages";
import type { CollabStage, Creator, Product, User } from "../../lib/types";

const STAGE_INDEX: Record<CollabStage, number> = Object.fromEntries(
  COLLAB_STAGE_ORDER.map((s, i) => [s.key, i])
) as Record<CollabStage, number>;
const REPLIED_IDX = STAGE_INDEX.replied;
const NEGOTIATING_IDX = STAGE_INDEX.negotiating;
const LOCKED_IDX = STAGE_INDEX.commercial_locked;
const PRODUCT_SENT_IDX = STAGE_INDEX.product_sent;

const CATEGORIES = [
  "Beauty",
  "Makeup",
  "Skincare",
  "Lifestyle",
  "Fashion",
  "Mom Creator",
  "Professional / Expert",
  "UGC Creator",
];

const PRIORITIES = [
  { label: "High", value: "priority" },
  { label: "Medium", value: "active" },
  { label: "Low", value: "none" },
];

type CreatorTab = "existing" | "new";

export function AddCollaborationModal({
  users,
  products,
  currentUserId,
  isAdmin,
  defaultOwnerId,
  initialStage,
  onClose,
  onCreated,
}: {
  users: User[];
  products: Product[];
  currentUserId: number;
  isAdmin: boolean;
  defaultOwnerId?: number;
  initialStage?: CollabStage;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [ownerId, setOwnerId] = useState(defaultOwnerId ?? currentUserId);

  const [tab, setTab] = useState<CreatorTab>("existing");
  const [existingCreators, setExistingCreators] = useState<Creator[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<number | "">("");

  const [newName, setNewName] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newFollowers, setNewFollowers] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newInstagramLink, setNewInstagramLink] = useState("");

  const [stage, setStage] = useState<CollabStage>(
    initialStage && initialStage !== "dead_leads" ? initialStage : STARTABLE_COLLAB_STAGES[0].key
  );
  const [priority, setPriority] = useState("active");
  const [productId, setProductId] = useState<number | "">(products[0]?.id ?? "");

  const [creatorReply, setCreatorReply] = useState("");
  const [commercialQuoted, setCommercialQuoted] = useState("");
  const [counterQuoteAgent, setCounterQuoteAgent] = useState("");
  const [counterQuoteCreator, setCounterQuoteCreator] = useState("");
  const [commercialAmount, setCommercialAmount] = useState("");
  const [trackingLink, setTrackingLink] = useState("");
  const [orderId, setOrderId] = useState("");
  const [additionalProductIds, setAdditionalProductIds] = useState<number[]>([]);
  const [liveAttributionProductIds, setLiveAttributionProductIds] = useState<number[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stageIdx = STAGE_INDEX[stage];
  const showReply = stageIdx >= REPLIED_IDX;
  const showNegotiation = stageIdx >= NEGOTIATING_IDX;
  const showLocked = stageIdx >= LOCKED_IDX;
  const showProductSent = stageIdx >= PRODUCT_SENT_IDX;
  const showLiveAttribution = stage === "live";

  const linkedProductIds = productId ? [productId, ...additionalProductIds] : additionalProductIds;

  function toggleId(list: number[], setList: (v: number[]) => void, id: number) {
    setList(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  }

  useEffect(() => {
    setLiveAttributionProductIds((prev) => prev.filter((id) => linkedProductIds.includes(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, additionalProductIds.join(",")]);

  useEffect(() => {
    api.get<{ items: Creator[]; total: number }>("/creators", { params: { owner_id: ownerId, limit: 500 } }).then((res) => {
      setExistingCreators(res.data.items);
      setSelectedCreatorId(res.data.items[0]?.id ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!productId) {
      setError("Choose a primary product.");
      return;
    }
    setSubmitting(true);
    try {
      let creatorId: number;
      if (tab === "existing") {
        if (!selectedCreatorId) {
          setError("Select an existing creator.");
          setSubmitting(false);
          return;
        }
        creatorId = selectedCreatorId;
      } else {
        const cleanHandle = newHandle.replace(/^@/, "").trim();
        if (!newName.trim() || !cleanHandle || !newFollowers) {
          setError("Fill in all required creator profile details.");
          setSubmitting(false);
          return;
        }
        const { data: created } = await api.post("/creators", {
          name: newName,
          instagram_handle: cleanHandle,
          phone: newPhone || null,
          email: newEmail || null,
          city: newCity || null,
          instagram_link: newInstagramLink || null,
          category: newCategory,
          followers_count: Number(newFollowers),
          owner_id: isAdmin ? ownerId : undefined,
        });
        creatorId = created.id;
      }

      if (showReply && !creatorReply.trim()) {
        setError("Creator reply is required for this stage.");
        setSubmitting(false);
        return;
      }
      if (showNegotiation && !commercialQuoted) {
        setError("Commercial quoted is required for this stage.");
        setSubmitting(false);
        return;
      }
      if (showLocked && !commercialAmount) {
        setError("Commercial locked amount is required for this stage.");
        setSubmitting(false);
        return;
      }
      if (showLiveAttribution && liveAttributionProductIds.length === 0) {
        setError("Select every product featured in this video.");
        setSubmitting(false);
        return;
      }

      await api.post("/collaborations", {
        creator_id: creatorId,
        primary_product_id: productId,
        additional_product_ids: additionalProductIds,
        live_attribution_product_ids: liveAttributionProductIds,
        owner_id: isAdmin ? ownerId : undefined,
        priority,
        stage,
        creator_reply: showReply ? creatorReply : null,
        commercial_quoted: showNegotiation && commercialQuoted ? Number(commercialQuoted) : null,
        counter_quote_agent: showNegotiation && counterQuoteAgent ? Number(counterQuoteAgent) : null,
        counter_quote_creator: showNegotiation && counterQuoteCreator ? Number(counterQuoteCreator) : null,
        commercial_amount: showLocked && commercialAmount ? Number(commercialAmount) : null,
        tracking_link: showProductSent && trackingLink ? trackingLink : null,
        order_id: showProductSent && orderId ? orderId : null,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not create the collaboration. Check the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-full w-[560px] flex-col bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Add collaboration</h2>
            <p className="text-xs text-gray-500">Create a new Collab ID at any lifecycle stage.</p>
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
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={`rounded-lg border px-3 py-2 text-left text-xs ${
              tab === "existing" ? "border-brand-200 bg-brand-50" : "border-[#e7e5e4]"
            }`}
          >
            <div className="font-semibold text-ink">Existing creator</div>
            <div className="text-gray-500">Select a unique username already in Database</div>
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`rounded-lg border px-3 py-2 text-left text-xs ${
              tab === "new" ? "border-brand-200 bg-brand-50" : "border-[#e7e5e4]"
            }`}
          >
            <div className="font-semibold text-ink">New creator</div>
            <div className="text-gray-500">Create the creator and first collaboration together</div>
          </button>
        </div>

        {tab === "existing" && (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">Existing Instagram username</label>
            <select
              value={selectedCreatorId}
              onChange={(e) => setSelectedCreatorId(Number(e.target.value))}
              className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {existingCreators.length === 0 && <option value="">No creators yet</option>}
              {existingCreators.map((c) => (
                <option key={c.id} value={c.id}>
                  @{c.instagram_handle} · {c.name}
                </option>
              ))}
            </select>
            <p className="mb-3 text-[11px] text-gray-400">
              A new Collab ID will be created. The creator username and Creator ID remain unchanged.
            </p>
          </>
        )}

        {tab === "new" && (
          <div className="mb-3 rounded-md border border-gray-200 p-3">
            <p className="text-xs font-semibold text-ink">Creator profile details</p>
            <p className="mb-3 text-[11px] text-gray-500">
              These details create the permanent creator record in Database before the Collab ID is generated.{" "}
              <span className="font-semibold text-amber-600">Database required</span>
            </p>

            <label className="mb-1 block text-sm font-medium text-gray-700">Creator name · Required</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-sm font-medium text-gray-700">
              Unique Instagram username · Required
            </label>
            <input
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              placeholder="@username"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-sm font-medium text-gray-700">Phone / WhatsApp · Optional</label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-sm font-medium text-gray-700">Email address · Optional</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="creator@email.com"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="-mt-1 mb-2 text-[11px] text-gray-400">
              Phone and email aren't required for a new lead — they'll be asked for once the creator replies.
            </p>

            <label className="mb-1 block text-sm font-medium text-gray-700">Category · Required</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-sm font-medium text-gray-700">Follower count · Required</label>
            <input
              type="number"
              min={0}
              value={newFollowers}
              onChange={(e) => setNewFollowers(e.target.value)}
              placeholder="85000"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mb-2 text-[11px] text-gray-400">
              Use numbers only. For example, enter 85000 instead of 85K.
            </p>

            <label className="mb-1 block text-sm font-medium text-gray-700">City · Optional</label>
            <input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="Delhi"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-sm font-medium text-gray-700">Instagram profile link · Optional</label>
            <input
              type="url"
              value={newInstagramLink}
              onChange={(e) => setNewInstagramLink(e.target.value)}
              placeholder="Auto-created from username if blank"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-2 text-[11px] text-gray-400">
              Username, phone and email will be checked for duplicates before the creator is added.
            </p>
          </div>
        )}

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Starting stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as CollabStage)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {STARTABLE_COLLAB_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Primary product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">Synced product master · no free-text duplicates</p>
          </div>

          {isAdmin && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Assign to user</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

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
            <label className="mb-1 block text-sm font-medium text-gray-700">Counter quote · From agent</label>
            <input
              type="number"
              min={0}
              value={counterQuoteAgent}
              onChange={(e) => setCounterQuoteAgent(e.target.value)}
              placeholder="₹14,000"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-sm font-medium text-gray-700">Counter quote · From creator</label>
            <input
              type="number"
              min={0}
              value={counterQuoteCreator}
              onChange={(e) => setCounterQuoteCreator(e.target.value)}
              placeholder="₹15,000"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {showProductSent && (
          <div className="mb-3 rounded-md border border-gray-200 p-3">
            <p className="mb-2 text-xs font-semibold text-ink">Product Sent requirements</p>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tracking link</label>
            <input
              value={trackingLink}
              onChange={(e) => setTrackingLink(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-sm font-medium text-gray-700">Order ID</label>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mb-1 text-sm font-medium text-gray-700">Products sent</p>
            <div className="grid grid-cols-2 gap-1">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={p.id === productId || additionalProductIds.includes(p.id)}
                    disabled={p.id === productId}
                    onChange={() => toggleId(additionalProductIds, setAdditionalProductIds, p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {showLiveAttribution && (
          <div className="mb-3 rounded-md border border-gray-200 p-3">
            <p className="text-xs font-semibold text-ink">Live attribution · Required</p>
            <p className="mb-2 text-[11px] text-gray-500">Select every product featured in this video.</p>
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
              {submitting ? "Creating..." : "Create Collab ID"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
