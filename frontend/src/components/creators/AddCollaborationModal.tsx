import { Plus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { COLLAB_STAGE_ORDER, STARTABLE_COLLAB_STAGES } from "../../lib/collab-stages";
import type {
  CollabStage,
  ContentBucket,
  ContentType,
  Creator,
  DealType,
  Language,
  Platform,
  Product,
  User,
} from "../../lib/types";

interface VideoLinkRow {
  platform: Platform | "";
  url: string;
}

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
  canAssignOwner,
  defaultOwnerId,
  initialStage,
  onClose,
  onCreated,
}: {
  users: User[];
  products: Product[];
  currentUserId: number;
  canAssignOwner: boolean;
  defaultOwnerId?: number;
  initialStage?: CollabStage;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [ownerId, setOwnerId] = useState(defaultOwnerId ?? currentUserId);

  const [tab, setTab] = useState<CreatorTab>("existing");
  const [existingCreators, setExistingCreators] = useState<Creator[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<number | "">("");
  const [creatorSearch, setCreatorSearch] = useState("");
  const [creatorDropdownOpen, setCreatorDropdownOpen] = useState(false);

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
  const [dealType, setDealType] = useState<DealType | "">("");
  const [contentType, setContentType] = useState<ContentType | "">("");
  const [trackingLink, setTrackingLink] = useState("");
  const [orderId, setOrderId] = useState("");
  const [pocCode, setPocCode] = useState("");
  const [videoLinks, setVideoLinks] = useState<VideoLinkRow[]>([{ platform: "", url: "" }]);
  const [language, setLanguage] = useState("");
  const [contentBucket, setContentBucket] = useState("");
  const [languages, setLanguages] = useState<Language[]>([]);
  const [contentBuckets, setContentBuckets] = useState<ContentBucket[]>([]);
  const [additionalProductIds, setAdditionalProductIds] = useState<number[]>([]);
  const [liveAttributionProductIds, setLiveAttributionProductIds] = useState<number[]>([]);
  const [productVariants, setProductVariants] = useState<Record<number, number>>({});

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

  function updateVideoLink(index: number, patch: Partial<VideoLinkRow>) {
    setVideoLinks((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addVideoLink() {
    setVideoLinks((prev) => [...prev, { platform: "", url: "" }]);
  }

  function removeVideoLink(index: number) {
    setVideoLinks((prev) => prev.filter((_, i) => i !== index));
  }

  useEffect(() => {
    setLiveAttributionProductIds((prev) => prev.filter((id) => linkedProductIds.includes(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, additionalProductIds.join(",")]);

  useEffect(() => {
    api.get<{ items: Creator[]; total: number }>("/creators", { params: { owner_id: ownerId, limit: 500 } }).then((res) => {
      setExistingCreators(res.data.items);
      const first = res.data.items[0];
      setSelectedCreatorId(first?.id ?? "");
      setCreatorSearch(first ? `@${first.instagram_handle} · ${first.name}` : "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  useEffect(() => {
    api.get<Language[]>("/languages").then((res) => setLanguages(res.data));
    api.get<ContentBucket[]>("/content-buckets").then((res) => setContentBuckets(res.data));
  }, []);

  const filteredCreators = creatorSearch.trim()
    ? existingCreators.filter((c) =>
        `${c.instagram_handle} ${c.name}`.toLowerCase().includes(creatorSearch.trim().toLowerCase())
      )
    : existingCreators;

  function selectCreator(c: Creator) {
    setSelectedCreatorId(c.id);
    setCreatorSearch(`@${c.instagram_handle} · ${c.name}`);
    setCreatorDropdownOpen(false);
  }

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
          owner_id: canAssignOwner ? ownerId : undefined,
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
      if (showNegotiation && !dealType) {
        setError("Select a deal type.");
        setSubmitting(false);
        return;
      }
      if (showLocked && !contentType) {
        setError("Select a content type.");
        setSubmitting(false);
        return;
      }
      if (showLiveAttribution && liveAttributionProductIds.length === 0) {
        setError("Select every product featured in this video.");
        setSubmitting(false);
        return;
      }
      if (showProductSent && !trackingLink.trim()) {
        setError("Tracking link is required for this stage.");
        setSubmitting(false);
        return;
      }
      if (showProductSent && !orderId.trim()) {
        setError("Order ID is required for this stage.");
        setSubmitting(false);
        return;
      }
      if (showLiveAttribution && !pocCode.trim()) {
        setError("POC code is required for this stage.");
        setSubmitting(false);
        return;
      }
      if (showLiveAttribution && (!videoLinks[0].url.trim() || !videoLinks[0].platform)) {
        setError("The first video link and its platform are required.");
        setSubmitting(false);
        return;
      }
      if (videoLinks.some((row, i) => i > 0 && row.url.trim() && !row.platform)) {
        setError("Choose a platform for every video link you've added.");
        setSubmitting(false);
        return;
      }
      if (showLiveAttribution && !language) {
        setError("Select a language.");
        setSubmitting(false);
        return;
      }
      if (showLiveAttribution && !contentBucket) {
        setError("Select a content bucket.");
        setSubmitting(false);
        return;
      }

      const activeVariants = Object.fromEntries(
        Object.entries(productVariants).filter(([pid]) => linkedProductIds.includes(Number(pid)))
      );

      await api.post("/collaborations", {
        creator_id: creatorId,
        primary_product_id: productId,
        additional_product_ids: additionalProductIds,
        live_attribution_product_ids: liveAttributionProductIds,
        product_variants: activeVariants,
        owner_id: canAssignOwner ? ownerId : undefined,
        priority,
        stage,
        creator_reply: showReply ? creatorReply : null,
        commercial_quoted: showNegotiation && commercialQuoted ? Number(commercialQuoted) : null,
        counter_quote_agent: showNegotiation && counterQuoteAgent ? Number(counterQuoteAgent) : null,
        counter_quote_creator: showNegotiation && counterQuoteCreator ? Number(counterQuoteCreator) : null,
        commercial_amount: showLocked && commercialAmount ? Number(commercialAmount) : null,
        deal_type: showNegotiation && dealType ? dealType : null,
        content_type: showLocked && contentType ? contentType : null,
        tracking_link: showProductSent && trackingLink ? trackingLink : null,
        order_id: showProductSent && orderId ? orderId : null,
        poc_code: showLiveAttribution && pocCode ? pocCode : null,
        video_link: showLiveAttribution ? videoLinks[0].url.trim() : null,
        platform: showLiveAttribution ? videoLinks[0].platform || null : null,
        additional_video_links: showLiveAttribution
          ? videoLinks
              .slice(1)
              .filter((row) => row.url.trim() && row.platform)
              .map((row) => ({ platform: row.platform, url: row.url.trim() }))
          : [],
        language: showLiveAttribution && language ? language : null,
        content_bucket: showLiveAttribution && contentBucket ? contentBucket : null,
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
            <div className="relative mb-1">
              <input
                value={creatorSearch}
                onChange={(e) => {
                  setCreatorSearch(e.target.value);
                  setCreatorDropdownOpen(true);
                }}
                onFocus={() => {
                  setCreatorSearch("");
                  setCreatorDropdownOpen(true);
                }}
                onBlur={() =>
                  setTimeout(() => {
                    setCreatorDropdownOpen(false);
                    const selected = existingCreators.find((c) => c.id === selectedCreatorId);
                    setCreatorSearch(selected ? `@${selected.instagram_handle} · ${selected.name}` : "");
                  }, 150)
                }
                placeholder="Search by username or name..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {creatorDropdownOpen && (
                <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {filteredCreators.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No matching creators</div>
                  )}
                  {filteredCreators.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => selectCreator(c)}
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface ${
                        c.id === selectedCreatorId ? "bg-brand-50 font-medium text-brand-700" : "text-ink"
                      }`}
                    >
                      @{c.instagram_handle} · {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            {(() => {
              const selected = products.find((p) => p.id === productId);
              if (!selected || selected.variants.length === 0) return null;
              return (
                <select
                  value={productId ? productVariants[productId] ?? "" : ""}
                  onChange={(e) =>
                    productId &&
                    setProductVariants((prev) => ({ ...prev, [productId]: Number(e.target.value) }))
                  }
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">No shade selected</option>
                  {selected.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              );
            })()}
          </div>

          {canAssignOwner && (
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

        {showProductSent && (
          <div className="mb-3 rounded-md border border-gray-200 p-3">
            <p className="mb-2 text-xs font-semibold text-ink">Product Sent requirements</p>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tracking link · Required</label>
            <input
              value={trackingLink}
              onChange={(e) => setTrackingLink(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-sm font-medium text-gray-700">Order ID · Required</label>
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
            {additionalProductIds
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
          </div>
        )}

        {showLiveAttribution && (
          <div className="mb-3 rounded-md border border-gray-200 p-3">
            <p className="mb-2 text-xs font-semibold text-ink">Live requirements</p>

            <label className="mb-1 block text-sm font-medium text-gray-700">POC code · Required</label>
            <input
              value={pocCode}
              onChange={(e) => setPocCode(e.target.value)}
              placeholder="AN_Creator_1006"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-sm font-medium text-gray-700">Video / Reel link · Required</label>
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
              className="mb-2 mt-1.5 flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              <Plus size={12} /> Add another link
            </button>

            <label className="mb-1 block text-sm font-medium text-gray-700">Language · Required</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select...</option>
              {languages.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-sm font-medium text-gray-700">Content bucket · Required</label>
            <select
              value={contentBucket}
              onChange={(e) => setContentBucket(e.target.value)}
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select...</option>
              {contentBuckets.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            <p className="mb-1 text-sm font-medium text-gray-700">Live attribution · Required</p>
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
