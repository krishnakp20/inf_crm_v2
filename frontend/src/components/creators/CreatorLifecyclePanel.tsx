import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Check,
  Download,
  FileText,
  Paperclip,
  PlayCircle,
  Pencil,
  Receipt,
  Send,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { compactNumber, initials } from "../../lib/format";
import type {
  CreatorDetail,
  CreatorFile,
  CreatorLifecycle,
  Message,
  MessageChannel,
} from "../../lib/types";

type Tab = "overview" | "video" | "commercial" | "conversation" | "files";

const TIMELINE_ICONS: Record<string, typeof ArrowRight> = {
  stage: ArrowRight,
  video: PlayCircle,
  commercial: Receipt,
  ownership: UsersRound,
  added: FileText,
};

const CHANNEL_OPTIONS: { label: string; value: MessageChannel }[] = [
  { label: "Note", value: "note" },
  { label: "Call", value: "call" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Email", value: "email" },
  { label: "Instagram DM", value: "instagram_dm" },
];

const CHANNEL_LABELS: Record<MessageChannel, string> = {
  note: "Note",
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  instagram_dm: "Instagram DM",
};

const CATEGORIES = ["Beauty", "Lifestyle", "Makeup", "Skincare", "Fitness", "Fashion"];
const STATUS_OPTIONS = [
  { label: "High", value: "priority" },
  { label: "Medium", value: "active" },
  { label: "Low", value: "none" },
];

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const lines = [header.join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
  const [data, setData] = useState<CreatorLifecycle | null>(null);
  const [detail, setDetail] = useState<CreatorDetail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editFollowers, setEditFollowers] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageChannel, setMessageChannel] = useState<MessageChannel>("note");
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [files, setFiles] = useState<CreatorFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadLifecycle() {
    api.get<CreatorLifecycle>(`/creators/${creatorId}/lifecycle`).then((res) => setData(res.data));
  }

  function loadDetail() {
    api.get<CreatorDetail>(`/creators/${creatorId}/detail`).then((res) => setDetail(res.data));
  }

  function loadMessages() {
    api.get<Message[]>(`/creators/${creatorId}/messages`).then((res) => setMessages(res.data));
  }

  function loadFiles() {
    api.get<CreatorFile[]>(`/creators/${creatorId}/files`).then((res) => setFiles(res.data));
  }

  useEffect(() => {
    loadLifecycle();
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId]);

  useEffect(() => {
    if (tab === "conversation" && messages.length === 0) loadMessages();
    if (tab === "files" && files.length === 0) loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, creatorId]);

  function startEdit() {
    if (!detail) return;
    const { creator } = detail;
    setEditName(creator.name);
    setEditPhone(creator.phone ?? "");
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

  async function sendMessage() {
    if (!messageDraft.trim()) return;
    setSendingMessage(true);
    try {
      await api.post(`/creators/${creatorId}/messages`, { channel: messageChannel, body: messageDraft });
      setMessageDraft("");
      loadMessages();
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("upload", file);
      await api.post(`/creators/${creatorId}/files`, formData);
      loadFiles();
    } finally {
      setUploadingFile(false);
    }
  }

  async function downloadFile(f: CreatorFile) {
    setDownloadingFileId(f.id);
    try {
      const res = await api.get(`/creators/${creatorId}/files/${f.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = f.original_filename;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingFileId(null);
    }
  }

  async function deleteFile(f: CreatorFile) {
    await api.delete(`/creators/${creatorId}/files/${f.id}`);
    setFiles((prev) => prev.filter((existing) => existing.id !== f.id));
  }

  if (!data || !detail) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30">
        <div className="fixed right-0 top-0 h-full w-[560px] bg-white p-6 shadow-lg">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <aside
        className="fixed right-0 top-0 flex h-full w-[560px] flex-col bg-white shadow-lg"
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
              onClick={toggleArchive}
              title={detail.creator.is_archived ? "Unarchive" : "Archive"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface hover:text-brand-600"
            >
              {detail.creator.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
            <button
              onClick={onClose}
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
              onClick={() => setTab("conversation")}
              className={`border-b-2 px-3 py-3 text-sm font-semibold ${
                tab === "conversation" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-ink"
              }`}
            >
              Conversation
            </button>
            <button
              onClick={() => setTab("files")}
              className={`border-b-2 px-3 py-3 text-sm font-semibold ${
                tab === "files" ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-ink"
              }`}
            >
              Files
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
                    <th className="py-2">Video</th>
                    <th className="py-2">Live date</th>
                    <th className="py-2">Cost</th>
                    <th className="py-2">Views</th>
                    <th className="py-2">Comments</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.video_history.map((v, i) => (
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
                    <th className="py-2">Collab / Campaign</th>
                    <th className="py-2">Creator quote</th>
                    <th className="py-2">Agent counter</th>
                    <th className="py-2">Creator counter</th>
                    <th className="py-2">Locked</th>
                    <th className="py-2">User / Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.commercial_history.rows.map((r, i) => (
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

          {!editing && tab === "conversation" && (
            <div className="flex flex-col gap-3">
              {messages.length === 0 && <p className="text-sm text-gray-400">No conversation history tracked yet.</p>}
              {messages.map((m) => (
                <div key={m.id} className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">{m.author_name}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      {CHANNEL_LABELS[m.channel]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{m.body}</p>
                  <div className="mt-1 text-[11px] text-gray-400">
                    {new Date(m.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!editing && tab === "files" && (
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#e7e5e4] px-4 py-3 text-sm font-semibold text-ink hover:border-brand-200 hover:text-brand-600 disabled:opacity-50"
              >
                <Paperclip size={14} />
                {uploadingFile ? "Uploading..." : "Upload a file"}
              </button>

              {files.length === 0 && <p className="text-sm text-gray-400">No files uploaded yet.</p>}
              <div className="flex flex-col gap-2">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 rounded-card border border-[#e7e5e4] p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{f.original_filename}</div>
                      <div className="text-xs text-gray-400">
                        {formatBytes(f.size_bytes)} · {f.uploaded_by_name} · {new Date(f.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => downloadFile(f)}
                        disabled={downloadingFileId === f.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-surface hover:text-brand-600 disabled:opacity-50"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => deleteFile(f)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-surface hover:text-[#cf4e43]"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!editing && tab === "conversation" && (
          <div className="border-t border-[#e7e5e4] p-4">
            <div className="flex items-end gap-2">
              <select
                value={messageChannel}
                onChange={(e) => setMessageChannel(e.target.value as MessageChannel)}
                className="rounded-lg border border-[#e7e5e4] bg-white px-2 py-2 text-xs text-gray-600"
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <textarea
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                placeholder="Log a call, message, or note..."
                className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={sendingMessage || !messageDraft.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
