import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Check,
  Download,
  FileText,
  PlayCircle,
  Pencil,
  Receipt,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSort } from "../../hooks/useSort";
import { api } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { compactNumber, formatCurrency, initials } from "../../lib/format";
import { SortableHeader } from "../shared/SortableHeader";
import type {
  ActivityLogEntry,
  CommercialHistoryRow,
  CreatorDetail,
  CreatorLifecycle,
  User,
  VideoHistoryRow,
} from "../../lib/types";

function getVideoHistoryValue(v: VideoHistoryRow, field: string): unknown {
  switch (field) {
    case "product_name":
      return v.product_name;
    case "live_date":
      return v.live_date;
    case "cost":
      return v.cost;
    case "views":
      return v.views;
    case "comments":
      return v.comments;
    case "status":
      return v.status;
    default:
      return null;
  }
}

function getCommercialHistoryValue(r: CommercialHistoryRow, field: string): unknown {
  switch (field) {
    case "product_name":
      return r.product_name;
    case "creator_quote":
      return r.creator_quote;
    case "agent_counter":
      return r.agent_counter;
    case "creator_counter":
      return r.creator_counter;
    case "locked":
      return r.locked;
    case "user_name":
      return r.user_name;
    default:
      return null;
  }
}

type Tab = "overview" | "video" | "commercial" | "activity";

const ACTIVITY_EVENT_STYLES: Record<ActivityLogEntry["event_type"], string> = {
  assigned: "bg-brand-50 text-brand-700",
  transferred: "bg-blue-50 text-blue-700",
  admin_assigned: "bg-amber-50 text-amber-700",
  revoked: "bg-red-50 text-red-700",
};

const ACTIVITY_EVENT_LABELS: Record<ActivityLogEntry["event_type"], string> = {
  assigned: "Assigned",
  transferred: "Transferred",
  admin_assigned: "Admin assigned",
  revoked: "Revoked",
};

const TIMELINE_ICONS: Record<string, typeof ArrowRight> = {
  stage: ArrowRight,
  video: PlayCircle,
  commercial: Receipt,
  ownership: UsersRound,
  added: FileText,
};

const CATEGORIES = ["Beauty", "Lifestyle", "Makeup", "Skincare", "Fitness", "Fashion"];
const STATUS_OPTIONS = [
  { label: "High", value: "priority" },
  { label: "Medium", value: "active" },
  { label: "Low", value: "none" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function CreatorLifecyclePanel({
  creatorId,
  onClose,
  onChanged,
}: {
  creatorId: number;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<CreatorLifecycle | null>(null);
  const videoHistorySort = useSort(data?.video_history ?? [], getVideoHistoryValue);
  const commercialHistorySort = useSort(data?.commercial_history.rows ?? [], getCommercialHistoryValue);
  const [detail, setDetail] = useState<CreatorDetail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAlternatePhone, setEditAlternatePhone] = useState("");
  const [editFollowers, setEditFollowers] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [advisors, setAdvisors] = useState<User[]>([]);
  const [transferTargetId, setTransferTargetId] = useState<number | "">("");
  const [transferring, setTransferring] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [archivePromptOpen, setArchivePromptOpen] = useState(false);
  const [archiveNote, setArchiveNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<"transfer" | "revoke" | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: "transfer" | "revoke"; label: string; secondsLeft: number } | null>(
    null
  );
  const pendingTimeoutRef = useRef<number | null>(null);
  const pendingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
      if (pendingIntervalRef.current) window.clearInterval(pendingIntervalRef.current);
    };
  }, []);

  function cancelPendingAction() {
    if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
    if (pendingIntervalRef.current) window.clearInterval(pendingIntervalRef.current);
    pendingTimeoutRef.current = null;
    pendingIntervalRef.current = null;
    setPendingAction(null);
  }

  function handleClose() {
    cancelPendingAction();
    onClose();
  }

  function loadLifecycle() {
    api.get<CreatorLifecycle>(`/creators/${creatorId}/lifecycle`).then((res) => setData(res.data));
  }

  function loadDetail() {
    api.get<CreatorDetail>(`/creators/${creatorId}/detail`).then((res) => setDetail(res.data));
  }

  useEffect(() => {
    loadLifecycle();
    loadDetail();
    setTransferTargetId("");
    api.get<User[]>("/users").then((res) => {
      const activeAdvisors = res.data.filter((u) => u.role === "advisor" && u.is_active);
      setAdvisors(
        user?.role === "supervisor" ? activeAdvisors.filter((a) => a.supervisor_id === user.id) : activeAdvisors
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId]);

  useEffect(() => {
    if (transferTargetId !== "" || !detail) return;
    const first = advisors.find((a) => a.id !== detail.creator.owner_id);
    if (first) setTransferTargetId(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisors, detail]);

  function startEdit() {
    if (!detail) return;
    const { creator } = detail;
    setEditName(creator.name);
    setEditPhone(creator.phone ?? "");
    setEditAlternatePhone(creator.alternate_phone ?? "");
    setEditFollowers(String(creator.followers_count));
    setEditCategory(creator.category);
    setEditStatus(
      creator.status === "review_due" || creator.status === "overdue" || creator.status === "ndr"
        ? "priority"
        : creator.status
    );
    setEditNotes(creator.notes ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    setSavingEdit(true);
    try {
      await api.patch(`/creators/${creatorId}`, {
        name: editName,
        phone: editPhone || null,
        alternate_phone: editAlternatePhone || null,
        followers_count: Number(editFollowers) || 0,
        category: editCategory,
        status: editStatus,
        notes: editNotes || null,
      });
      setEditing(false);
      loadDetail();
      loadLifecycle();
      onChanged?.();
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleArchive() {
    if (!detail) return;
    await api.patch(`/creators/${creatorId}`, { is_archived: !detail.creator.is_archived });
    loadDetail();
    onChanged?.();
  }

  function handleArchiveButtonClick() {
    if (!detail) return;
    if (detail.creator.is_archived) {
      // Un-archiving needs no note -- only moving TO archive does.
      toggleArchive();
    } else {
      setArchiveNote("");
      setArchivePromptOpen(true);
    }
  }

  async function confirmArchiveWithNote() {
    if (!archiveNote.trim()) return;
    await api.patch(`/creators/${creatorId}`, { is_archived: true, archive_reason: archiveNote });
    setArchivePromptOpen(false);
    loadDetail();
    onChanged?.();
  }

  const otherAdvisors = advisors.filter((a) => a.id !== detail?.creator.owner_id);
  const isOwner =
    !!user &&
    !!detail &&
    ((user.role === "advisor" && detail.creator.owner_id === user.id) ||
      (user.role === "supervisor" && advisors.some((a) => a.id === detail.creator.owner_id)));
  const ownershipSince = data?.ownership_history.find((o) => o.status === "current")?.since_label;

  async function transferOwnership() {
    if (!transferTargetId) return;
    setOwnershipError(null);
    setTransferring(true);
    try {
      await api.post(`/creators/${creatorId}/transfer-ownership`, { new_owner_id: transferTargetId });
      onChanged?.();
      onClose();
    } catch (err: any) {
      setOwnershipError(err.response?.data?.detail ?? "Could not transfer ownership.");
    } finally {
      setTransferring(false);
    }
  }

  async function revokeOwnership() {
    setOwnershipError(null);
    setRevoking(true);
    try {
      await api.patch(`/creators/${creatorId}`, { is_archived: true, archive_reason: revokeReason || null });
      onChanged?.();
      onClose();
    } catch (err: any) {
      setOwnershipError(err.response?.data?.detail ?? "Could not revoke ownership.");
    } finally {
      setRevoking(false);
    }
  }

  function schedulePendingAction(type: "transfer" | "revoke", label: string) {
    setConfirmAction(null);
    setPendingAction({ type, label, secondsLeft: 10 });
    pendingIntervalRef.current = window.setInterval(() => {
      setPendingAction((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : prev));
    }, 1000);
    pendingTimeoutRef.current = window.setTimeout(() => {
      pendingTimeoutRef.current = null;
      if (pendingIntervalRef.current) window.clearInterval(pendingIntervalRef.current);
      pendingIntervalRef.current = null;
      setPendingAction(null);
      if (type === "transfer") transferOwnership();
      else revokeOwnership();
    }, 10000);
  }

  if (!data || !detail) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30">
        <div className="fixed right-0 top-0 h-full w-[50vw] min-w-[560px] bg-white p-6 shadow-lg">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={handleClose}>
      <aside
        className="fixed right-0 top-0 flex h-full w-[50vw] min-w-[560px] flex-col bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">
              {initials(data.creator_name)}
            </div>
            <div>
              <div className="text-base font-semibold text-ink">{data.creator_name}</div>
              <div className="text-xs text-gray-500">
                @{data.creator_handle} · {compactNumber(data.followers_count)} followers
              </div>
              <div className="text-xs text-gray-400">User: {data.owner_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startEdit}
              title="Edit creator"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface hover:text-brand-600"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleArchiveButtonClick}
              title={detail.creator.is_archived ? "Unarchive" : "Archive"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface hover:text-brand-600"
            >
              {detail.creator.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
            <button
              onClick={handleClose}
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {!editing && (
          <div className="flex border-b border-[#e7e5e4] px-5">
            <button
              onClick={() => setTab("overview")}
              className={`border-b-2 px-3 py-3 text-sm font-semibold ${
                tab === "overview" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-ink"
              }`}
            >
              Lifecycle overview
            </button>
            <button
              onClick={() => setTab("video")}
              className={`border-b-2 px-3 py-3 text-sm font-semibold ${
                tab === "video" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-ink"
              }`}
            >
              Video history <span className="text-gray-400">{data.video_history.length}</span>
            </button>
            <button
              onClick={() => setTab("commercial")}
              className={`border-b-2 px-3 py-3 text-sm font-semibold ${
                tab === "commercial" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-ink"
              }`}
            >
              Commercial history <span className="text-gray-400">{data.commercial_history.rows.length}</span>
            </button>
            <button
              onClick={() => setTab("activity")}
              className={`border-b-2 px-3 py-3 text-sm font-semibold ${
                tab === "activity" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-ink"
              }`}
            >
              Activity log <span className="text-gray-400">{(data.activity_log ?? []).length}</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Creator name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone number</label>
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Alternate mobile number</label>
              <input
                value={editAlternatePhone}
                onChange={(e) => setEditAlternatePhone(e.target.value)}
                placeholder="Optional"
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Followers</label>
              <input
                type="number"
                min={0}
                value={editFollowers}
                onChange={(e) => setEditFollowers(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          )}

          {!editing && tab === "overview" && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="text-[10px] text-muted">Added to database</div>
                  <div className="mt-1 text-sm font-bold text-ink">{formatDate(data.summary.added_at)}</div>
                </div>
                <div className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="text-[10px] text-muted">Current stage</div>
                  <div className="mt-1 text-sm font-bold text-ink">{data.summary.current_stage_label}</div>
                </div>
                <div className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="text-[10px] text-muted">Videos delivered</div>
                  <div className="mt-1 text-sm font-bold text-ink">{data.summary.videos_delivered}</div>
                </div>
                <div className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="text-[10px] text-muted">Last video live</div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {data.summary.last_video_live_at ? formatDate(data.summary.last_video_live_at) : "Not live"}
                  </div>
                </div>
                <div className="col-span-2 rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
                  <div className="text-[10px] text-muted">Last commercial locked</div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {formatCurrency(data.summary.last_commercial_locked)}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="text-sm font-semibold text-ink">Creator lifecycle</h3>
                <p className="mt-0.5 text-xs text-muted">Complete progress from database entry to live content</p>
                <div className="mt-3 flex items-start gap-1 overflow-x-auto pb-1">
                  {data.track.map((step, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5" style={{ minWidth: 54 }}>
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                          step.status === "complete"
                            ? "bg-brand-600 text-white"
                            : step.status === "current"
                              ? "bg-brand-100 text-brand-600 ring-2 ring-brand-600"
                              : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {step.status === "complete" ? <Check size={12} /> : i + 1}
                      </div>
                      <div
                        className={`text-center text-[10px] leading-tight ${
                          step.status === "upcoming" ? "text-gray-400" : "font-semibold text-ink"
                        }`}
                      >
                        {step.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Lifecycle history</h3>
                    <p className="mt-0.5 text-xs text-muted">Ownership, stage and video events with a permanent audit trail</p>
                  </div>
                  {data.collab_code && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                      {data.collab_code}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {data.timeline.map((entry, i) => {
                    const Icon = TIMELINE_ICONS[entry.icon] ?? ArrowRight;
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink">
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-ink">{entry.title}</div>
                            <span className="shrink-0 text-[11px] text-gray-400">{entry.timestamp_label}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">{entry.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {!editing && tab === "video" && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Delivered video history</h3>
                  <p className="mt-0.5 text-xs text-muted">Live date, commercials and performance for every delivered video</p>
                </div>
                <button
                  onClick={() =>
                    downloadCsv(
                      `${data.creator_handle}-video-history.csv`,
                      ["Video", "Live date", "Cost", "Views", "Comments", "Status"],
                      data.video_history.map((v) => [
                        v.product_name,
                        formatDate(v.live_date),
                        v.cost != null ? String(v.cost) : "",
                        v.views != null ? String(v.views) : "",
                        v.comments != null ? String(v.comments) : "",
                        v.status,
                      ])
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-[#e7e5e4] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface"
                >
                  <Download size={12} />
                  Export
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e7e5e4] text-left text-[10px] uppercase text-gray-400">
                    <SortableHeader label="Video" field="product_name" activeField={videoHistorySort.field} direction={videoHistorySort.direction} onSort={videoHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Live date" field="live_date" activeField={videoHistorySort.field} direction={videoHistorySort.direction} onSort={videoHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Cost" field="cost" activeField={videoHistorySort.field} direction={videoHistorySort.direction} onSort={videoHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Views" field="views" activeField={videoHistorySort.field} direction={videoHistorySort.direction} onSort={videoHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Comments" field="comments" activeField={videoHistorySort.field} direction={videoHistorySort.direction} onSort={videoHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Status" field="status" activeField={videoHistorySort.field} direction={videoHistorySort.direction} onSort={videoHistorySort.toggle} className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {videoHistorySort.sorted.map((v, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2.5 font-medium text-ink">{v.product_name}</td>
                      <td className="py-2.5 text-gray-600">{formatDate(v.live_date)}</td>
                      <td className="py-2.5 text-gray-600">{formatCurrency(v.cost)}</td>
                      <td className="py-2.5 text-gray-600">{v.views != null ? compactNumber(v.views) : "—"}</td>
                      <td className="py-2.5 text-gray-600">{v.comments != null ? v.comments.toLocaleString() : "—"}</td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            v.status === "Live" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.video_history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-gray-400">
                        No delivered videos yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!editing && tab === "commercial" && (
            <div>
              <h3 className="text-sm font-semibold text-ink">Commercial negotiation history</h3>
              <p className="mt-0.5 text-xs text-muted">Every quote, counter and final locked value by collaboration</p>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="text-[10px] text-muted">Last commercial locked</div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {formatCurrency(data.commercial_history.last_locked_amount)}
                  </div>
                  {data.commercial_history.last_locked_product_name && (
                    <div className="text-xs text-gray-400">{data.commercial_history.last_locked_product_name}</div>
                  )}
                </div>
                <div className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="text-[10px] text-muted">Average locked commercial</div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {formatCurrency(data.commercial_history.average_locked)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {data.commercial_history.retained_count} collaboration
                    {data.commercial_history.retained_count !== 1 ? "s" : ""} retained
                  </div>
                </div>
              </div>

              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e7e5e4] text-left text-[10px] uppercase text-gray-400">
                    <SortableHeader label="Collab / Campaign" field="product_name" activeField={commercialHistorySort.field} direction={commercialHistorySort.direction} onSort={commercialHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Creator quote" field="creator_quote" activeField={commercialHistorySort.field} direction={commercialHistorySort.direction} onSort={commercialHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Agent counter" field="agent_counter" activeField={commercialHistorySort.field} direction={commercialHistorySort.direction} onSort={commercialHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Creator counter" field="creator_counter" activeField={commercialHistorySort.field} direction={commercialHistorySort.direction} onSort={commercialHistorySort.toggle} className="py-2" />
                    <SortableHeader label="Locked" field="locked" activeField={commercialHistorySort.field} direction={commercialHistorySort.direction} onSort={commercialHistorySort.toggle} className="py-2" />
                    <SortableHeader label="User / Date" field="user_name" activeField={commercialHistorySort.field} direction={commercialHistorySort.direction} onSort={commercialHistorySort.toggle} className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {commercialHistorySort.sorted.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2.5">
                        <div className="font-medium text-ink">{r.product_name}</div>
                        <div className="text-xs text-gray-400">{r.collab_code}</div>
                      </td>
                      <td className="py-2.5 text-gray-600">{formatCurrency(r.creator_quote)}</td>
                      <td className="py-2.5 text-gray-600">{formatCurrency(r.agent_counter)}</td>
                      <td className="py-2.5 text-gray-600">{formatCurrency(r.creator_counter)}</td>
                      <td className="py-2.5 font-semibold text-ink">{formatCurrency(r.locked)}</td>
                      <td className="py-2.5 text-gray-600">
                        <div>{r.user_name}</div>
                        <div className="text-xs text-gray-400">{formatDate(r.date)}</div>
                      </td>
                    </tr>
                  ))}
                  {data.commercial_history.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-gray-400">
                        No commercial negotiation recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="mt-5">
                <h3 className="text-sm font-semibold text-ink">Ownership history</h3>
                <p className="mt-0.5 text-xs text-muted">Who managed this creator and when</p>
                <div className="mt-3 flex flex-col gap-2">
                  {data.ownership_history.map((o, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-card border border-[#e7e5e4] p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600">
                        {o.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink">{o.user_name}</div>
                        <div className="text-xs text-gray-500">
                          {o.status === "current" ? "Current user" : "Previous user"} · since {o.since_label}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          o.status === "current" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {o.status === "current" ? "Current" : "Previous"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!editing && tab === "activity" && (
            <div>
              <h3 className="text-sm font-semibold text-ink">Activity log</h3>
              <p className="mt-0.5 text-xs text-muted">
                Every ownership assignment, transfer and revoke for this creator, in order.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {(data.activity_log ?? []).map((a, i) => (
                  <div key={i} className="rounded-card border border-[#e7e5e4] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink">{a.title}</div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {a.actor_name ? `By ${a.actor_name}` : "System"} · {a.timestamp_label}
                        </div>
                        {a.event_type === "revoked" && (
                          <div className="mt-1 text-xs text-gray-500">{a.description}</div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ACTIVITY_EVENT_STYLES[a.event_type]}`}
                      >
                        {ACTIVITY_EVENT_LABELS[a.event_type]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!editing && isOwner && (
          <footer className="flex flex-col gap-2.5 border-t border-[#e7e5e4] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                  <ShieldCheck size={16} />
                  Current user: {detail.owner_name}
                </div>
                {ownershipSince && <div className="mt-0.5 text-xs text-gray-400">Ownership since {ownershipSince}</div>}
                {ownershipError && <div className="mt-1 text-xs text-red-600">{ownershipError}</div>}
              </div>
              <div className="flex items-center gap-2">
                {otherAdvisors.length > 0 && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      Transfer to
                      <select
                        value={transferTargetId}
                        onChange={(e) => setTransferTargetId(Number(e.target.value))}
                        className="rounded-lg border border-[#e7e5e4] bg-white px-2 py-1.5 text-xs font-semibold text-ink"
                      >
                        {otherAdvisors.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      onClick={() => setConfirmAction("transfer")}
                      disabled={transferring || !!pendingAction}
                      className="rounded-lg border border-[#e7e5e4] px-3 py-1.5 text-xs font-bold text-ink hover:bg-surface disabled:opacity-50"
                    >
                      {transferring ? "Transferring..." : "Transfer ownership"}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setConfirmAction("revoke")}
                  disabled={revoking || !!pendingAction}
                  className="rounded-lg border border-[#f3c9c5] px-3 py-1.5 text-xs font-bold text-[#cf4e43] hover:bg-[#fdf2f1] disabled:opacity-50"
                >
                  {revoking ? "Revoking..." : "Revoke ownership"}
                </button>
              </div>
            </div>
          </footer>
        )}

        {confirmAction && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30"
            onClick={() => setConfirmAction(null)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-[380px] rounded-card bg-white p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-ink">
                {confirmAction === "transfer" ? "Transfer ownership?" : "Revoke ownership?"}
              </h3>
              <p className="mt-1.5 text-xs text-muted">
                {confirmAction === "transfer"
                  ? `This creator will be reassigned to ${
                      otherAdvisors.find((a) => a.id === transferTargetId)?.name ?? "the selected advisor"
                    }.`
                  : "This creator will be archived and removed from the owner's active pipeline."}{" "}
                You'll have 10 seconds to undo right after confirming.
              </p>
              {confirmAction === "revoke" && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-gray-700">Reason for archiving · Required</label>
                  <input
                    autoFocus
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="e.g. Creator went unresponsive after 3 follow-ups"
                    className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-ink placeholder:text-gray-400"
                  />
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmAction === "revoke" && !revokeReason.trim()}
                  onClick={() =>
                    confirmAction === "transfer"
                      ? schedulePendingAction(
                          "transfer",
                          `Transferring ownership to ${
                            otherAdvisors.find((a) => a.id === transferTargetId)?.name ?? "advisor"
                          }`
                        )
                      : schedulePendingAction("revoke", "Revoking ownership")
                  }
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {confirmAction === "transfer" ? "Transfer ownership" : "Revoke ownership"}
                </button>
              </div>
            </div>
          </div>
        )}

        {archivePromptOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30"
            onClick={() => setArchivePromptOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-[380px] rounded-card bg-white p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-ink">Archive this creator?</h3>
              <p className="mt-1.5 text-xs text-muted">
                This creator will be archived and removed from the active pipeline.
              </p>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-gray-700">Note · Required</label>
                <input
                  autoFocus
                  value={archiveNote}
                  onChange={(e) => setArchiveNote(e.target.value)}
                  placeholder="e.g. Creator went unresponsive after 3 follow-ups"
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-ink placeholder:text-gray-400"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setArchivePromptOpen(false)}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!archiveNote.trim()}
                  onClick={confirmArchiveWithNote}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingAction && (
          <div className="fixed inset-x-0 top-4 z-[70] flex justify-center">
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 shadow-lg">
              {pendingAction.label} in {pendingAction.secondsLeft}s...
              <button
                type="button"
                onClick={cancelPendingAction}
                className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-100"
              >
                Undo
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
