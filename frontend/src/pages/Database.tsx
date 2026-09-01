import { ArrowUpDown, Download, Plus, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AddCreatorModal } from "../components/creators/AddCreatorModal";
import { ArchivedLeadsTable } from "../components/creators/ArchivedLeadsTable";
import { CreatorLifecyclePanel } from "../components/creators/CreatorLifecyclePanel";
import { CreatorTable } from "../components/creators/CreatorTable";
import { OwnershipCheck } from "../components/creators/OwnershipCheck";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { BulkUploadResult, BulkUploadRowResult, CreatorTableRow, Product, User } from "../lib/types";

const SORT_OPTIONS = [
  { label: "Creator name", value: "name" },
  { label: "Followers", value: "followers_count" },
  { label: "Videos delivered", value: "videos_delivered" },
  { label: "Last cost", value: "last_cost" },
  { label: "Last video live", value: "last_video_live_at" },
  { label: "Comment count", value: "comments_count" },
  { label: "Date added", value: "created_at" },
  { label: "Current stage", value: "current_stage" },
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 50, 100, 150];

export default function Database() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [creators, setCreators] = useState<CreatorTableRow[]>([]);
  const [total, setTotal] = useState(0);
  const [tabCounts, setTabCounts] = useState({ all: 0, archived: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"all" | "archived">("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [detailCreatorId, setDetailCreatorId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fromUrl = searchParams.get("search");
    if (fromUrl) setSearch(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    api.get<User[]>("/users").then((res) => setUsers(res.data));
    api.get<Product[]>("/products").then((res) => setProducts(res.data));
  }, []);

  const owners = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name])), [users]);
  const advisors = useMemo(() => {
    const active = users.filter((u) => u.role === "advisor" && u.is_active);
    return user?.role === "supervisor" ? active.filter((u) => u.supervisor_id === user.id) : active;
  }, [users, user]);
  const filterableUsers = useMemo(
    () => (user?.role === "supervisor" ? users.filter((u) => u.id === user.id || u.supervisor_id === user.id) : users),
    [users, user]
  );

  function loadCreators() {
    const params: Record<string, string | number | boolean> = {
      limit: pageSize,
      offset,
      is_archived: activeTab === "archived",
      sort_by: sortBy,
      sort_dir: sortDir,
    };
    if (ownerId) params.owner_id = ownerId;
    if (search) params.search = search;

    api.get("/creators/table", { params }).then((res) => {
      setCreators(res.data.items);
      setTotal(res.data.total);
    });
  }

  function loadTabCounts() {
    const base: Record<string, string | number | boolean> = { limit: 1, offset: 0 };
    if (ownerId) base.owner_id = ownerId;
    if (search) base.search = search;
    Promise.all([
      api.get("/creators/table", { params: { ...base, is_archived: false } }),
      api.get("/creators/table", { params: { ...base, is_archived: true } }),
    ]).then(([allRes, archivedRes]) => {
      setTabCounts({ all: allRes.data.total, archived: archivedRes.data.total });
    });
  }

  useEffect(loadCreators, [ownerId, activeTab, sortBy, sortDir, search, offset, pageSize]);
  useEffect(loadTabCounts, [ownerId, search]);

  if (user && (user.role === "marketer" || user.role === "editor")) {
    return <Navigate to="/" replace />;
  }

  function refresh() {
    loadCreators();
    loadTabCounts();
  }

  function handleSortChange(clickedField: string) {
    setOffset(0);
    if (sortBy === clickedField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(clickedField);
      setSortDir("asc");
    }
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("upload", file);
      const res = await api.post<BulkUploadResult>("/creators/bulk-upload", formData);
      const rows = res.data.rows ?? [];
      setUploadResult({ ...res.data, rows });
      downloadBulkUploadLog(rows);
      loadCreators();
    } finally {
      setUploading(false);
    }
  }

  function downloadBulkUploadLog(rows: BulkUploadRowResult[]) {
    const header = ["Row", "Instagram handle", "Name", "Status", "Reason", "Existing owner", "Existing stage"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          String(r.row),
          r.instagram_handle,
          r.name,
          r.status,
          r.reason,
          r.existing_owner ?? "",
          r.existing_stage ?? "",
        ]
          .map((v) => csvEscape(v))
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bulk-upload-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const header = ["name", "instagram_handle", "phone", "category", "followers_count", "owner_email"];
    const example = ["Ananya Rao", "ananyarao_official", "+91 98765 43210", "Beauty", "45000", ""];
    const lines = [header.join(","), example.map(csvEscape).join(",")];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "creators-bulk-upload-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const params: Record<string, string | number | boolean> = {
        limit: 5000,
        offset: 0,
        is_archived: activeTab === "archived",
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (ownerId) params.owner_id = ownerId;
      if (search) params.search = search;

      const res = await api.get("/creators/table", { params });
      const rows: CreatorTableRow[] = res.data.items;

      const header = [
        "Name",
        "Instagram handle",
        "Phone",
        "Category",
        "Followers",
        "Owner",
        "Added on",
        "Videos delivered",
        "Last cost",
        "Last video live",
        "Comments",
        "Current stage",
        "Status",
      ];
      const lines = [
        header.join(","),
        ...rows.map((c) =>
          [
            c.name,
            c.instagram_handle,
            c.phone ?? "",
            c.category,
            String(c.followers_count),
            owners[c.owner_id] ?? "",
            c.created_at,
            String(c.videos_delivered),
            c.last_cost != null ? String(c.last_cost) : "",
            c.last_video_live_at ?? "",
            String(c.comments_count ?? 0),
            c.current_collab_stage_label ?? "",
            c.status,
          ]
            .map((v) => csvEscape(v))
            .join(",")
        ),
      ];

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `creators-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Could not export creators. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <Topbar
        title="Creator database"
        subtitle="One list for every creator, assigned user and complete ownership history."
        actions={
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleBulkUpload}
            />
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-[10px] border border-[#e7e5e4] px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface disabled:opacity-50"
            >
              <Download size={14} />
              {exporting ? "Exporting..." : "Export"}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-[10px] border border-[#e7e5e4] px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface disabled:opacity-50"
            >
              <Upload size={14} />
              {uploading ? "Uploading..." : "Bulk upload"}
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              title="Download the bulk-upload sheet format"
              className="flex items-center gap-1.5 rounded-[10px] px-2 text-xs font-bold text-brand-600 hover:underline"
            >
              <Download size={12} />
              Download format
            </button>
            <button
              onClick={() => setShowAddCreator(true)}
              className="flex items-center gap-1.5 rounded-[10px] bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              Add creator
            </button>
          </div>
        }
      />

      {exportError && (
        <div className="mb-4 flex items-center justify-between rounded-card border border-[#f3c9c5] bg-[#fdf2f1] p-3 text-sm text-[#cf4e43]">
          <span>{exportError}</span>
          <button onClick={() => setExportError(null)} className="text-xs text-[#cf4e43] hover:opacity-70">
            Dismiss
          </button>
        </div>
      )}

      {uploadResult && (
        <div className="mb-4 rounded-card border border-[#e7e5e4] bg-white p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>
              Bulk upload: <strong>{uploadResult.created}</strong> created, <strong>{uploadResult.skipped}</strong>{" "}
              already present{uploadResult.errors.length > 0 && `, ${uploadResult.errors.length} errors`}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadBulkUploadLog(uploadResult.rows)}
                className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"
              >
                <Download size={12} />
                Download log
              </button>
              <button onClick={() => setUploadResult(null)} className="text-xs text-gray-400 hover:text-gray-600">
                Dismiss
              </button>
            </div>
          </div>
          {uploadResult.rows.some((r) => r.status === "already_present") && (
            <ul className="mt-2 list-disc pl-5 text-xs text-gray-500">
              {uploadResult.rows
                .filter((r) => r.status === "already_present")
                .map((r, i) => (
                  <li key={i}>
                    Row {r.row} · @{r.instagram_handle}: already present, owned by {r.existing_owner} · currently{" "}
                    {r.existing_stage}
                  </li>
                ))}
            </ul>
          )}
          {uploadResult.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-[#cf4e43]">
              {uploadResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showAddCreator && user && (
        <AddCreatorModal
          users={advisors}
          currentUserId={user.id}
          canAssignOwner={user.role === "admin" || user.role === "supervisor"}
          onClose={() => setShowAddCreator(false)}
          onCreated={refresh}
        />
      )}

      <OwnershipCheck owners={owners} />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <button
            onClick={() => {
              setActiveTab("all");
              setOffset(0);
            }}
            className={`text-[10px] font-bold ${activeTab === "all" ? "text-brand-600" : "text-[#77727d]"}`}
          >
            All creators <span className="text-gray-400">{tabCounts.all}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("archived");
              setOffset(0);
            }}
            className={`text-[10px] font-bold ${activeTab === "archived" ? "text-brand-600" : "text-[#77727d]"}`}
          >
            Archived leads <span className="text-gray-400">{tabCounts.archived}</span>
          </button>
        </div>
        {(user?.role === "admin" || user?.role === "supervisor") && (
          <label className="flex items-center gap-2">
            <span className="text-[8px] text-[#918d97]">Filter by user</span>
            <select
              value={ownerId}
              onChange={(e) => {
                setOffset(0);
                setOwnerId(e.target.value);
              }}
              className="rounded-lg border border-[#e7e5e4] bg-white px-2.5 py-1.5 text-xs font-bold text-ink"
            >
              <option value="">All users</option>
              {filterableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 w-full max-w-[510px] items-center gap-2 rounded-[9px] border border-[#e7e5e4] bg-white px-2.5">
          <Search size={14} className="shrink-0 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setOffset(0);
              setSearch(e.target.value);
            }}
            placeholder={activeTab === "archived" ? "Search archived creators..." : "Search name, username, phone or category..."}
            className="w-full text-xs text-ink placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        {activeTab === "all" && (
          <>
            <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5">
              <ArrowUpDown size={14} className="text-gray-400" />
              <select
                aria-label="Sort creator database"
                value={sortBy}
                onChange={(e) => {
                  setOffset(0);
                  setSortBy(e.target.value);
                }}
                className="bg-transparent text-xs font-semibold text-ink focus:outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="flex h-9 shrink-0 items-center rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-bold text-[#655f6b] hover:bg-surface"
            >
              {sortDir === "asc" ? "Low to high ↑" : "High to low ↓"}
            </button>
          </>
        )}
        <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5">
          <span className="text-xs text-gray-400">Per page</span>
          <select
            aria-label="Creators per page"
            value={pageSize}
            onChange={(e) => {
              setOffset(0);
              setPageSize(Number(e.target.value));
            }}
            className="bg-transparent text-xs font-semibold text-ink focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeTab === "archived" ? (
        <ArchivedLeadsTable
          creators={creators}
          owners={owners}
          advisors={advisors}
          total={total}
          limit={pageSize}
          offset={offset}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          onPageChange={setOffset}
          onView={setDetailCreatorId}
          onAssigned={refresh}
        />
      ) : (
        <CreatorTable
          creators={creators}
          owners={owners}
          products={products}
          total={total}
          limit={pageSize}
          offset={offset}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          onPageChange={setOffset}
          onView={setDetailCreatorId}
        />
      )}

      {detailCreatorId && (
        <CreatorLifecyclePanel
          creatorId={detailCreatorId}
          onClose={() => {
            setDetailCreatorId(null);
            refresh();
          }}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
