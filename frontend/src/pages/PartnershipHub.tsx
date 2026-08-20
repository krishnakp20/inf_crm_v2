import { useEffect, useState } from "react";
import { PartnershipClosedTable } from "../components/partnership/PartnershipClosedTable";
import { PartnershipFilters } from "../components/partnership/PartnershipFilters";
import { PartnershipOpenTable } from "../components/partnership/PartnershipOpenTable";
import { PartnershipOverviewTable } from "../components/partnership/PartnershipOverviewTable";
import { PartnershipStatsRow } from "../components/partnership/PartnershipStatsRow";
import { TakeActionModal } from "../components/partnership/TakeActionModal";
import { TicketDetailDrawer } from "../components/partnership/TicketDetailDrawer";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type {
  Platform,
  Product,
  PartnershipOpenRow,
  PartnershipOverviewRow,
  PartnershipStats,
  User,
} from "../lib/types";

type Tab = "overview" | "open" | "closed";

export default function PartnershipHub() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [overviewRows, setOverviewRows] = useState<PartnershipOverviewRow[]>([]);
  const [openRows, setOpenRows] = useState<PartnershipOpenRow[]>([]);
  const [closedRows, setClosedRows] = useState<PartnershipOverviewRow[]>([]);
  const [stats, setStats] = useState<PartnershipStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [productId, setProductId] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [contentBucket, setContentBucket] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [takeActionIds, setTakeActionIds] = useState<number[] | null>(null);
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);

  const params = {
    search: search || undefined,
    owner_id: ownerId || undefined,
    product_id: productId || undefined,
    platform: platform || undefined,
    content_bucket: contentBucket || undefined,
    language: language || undefined,
    category: category || undefined,
  };

  useEffect(() => {
    api.get<Product[]>("/products").then((res) => setProducts(res.data));
    api.get<User[]>("/users").then((res) => setUsers(res.data));
  }, []);

  function loadOverview() {
    api.get<PartnershipOverviewRow[]>("/partnership", { params }).then((res) => setOverviewRows(res.data));
  }
  function loadOpen() {
    api.get<PartnershipOpenRow[]>("/partnership/open", { params }).then((res) => setOpenRows(res.data));
  }
  function loadClosed() {
    api.get<PartnershipOverviewRow[]>("/partnership/closed", { params }).then((res) => setClosedRows(res.data));
  }
  function loadStats() {
    api.get<PartnershipStats>("/partnership/stats").then((res) => setStats(res.data));
  }

  useEffect(loadOverview, [search, ownerId, productId, platform, contentBucket, language, category]);
  useEffect(loadOpen, [search, ownerId, productId, platform, contentBucket, language, category]);
  useEffect(loadClosed, [search, ownerId, productId, platform, contentBucket, language, category]);
  useEffect(loadStats, []);

  function refresh() {
    loadOverview();
    loadOpen();
    loadClosed();
    loadStats();
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (overviewRows.length > 0 && overviewRows.every((r) => prev.has(r.ticket_id))) return new Set();
      return new Set(overviewRows.map((r) => r.ticket_id));
    });
  }

  const canTakeAction = user?.role === "admin" || user?.role === "marketer";
  const showCommercial = user?.role === "admin" || user?.role === "advisor";

  const singleTicket = takeActionIds && takeActionIds.length === 1 ? overviewRows.find((r) => r.ticket_id === takeActionIds[0]) : null;

  return (
    <div>
      <Topbar
        eyebrow="PARTNERSHIP WORKSPACE"
        title="Partnership Hub"
        subtitle="Track ad rights, ad codes and CTA links for every video that's gone live."
      />

      {stats && <PartnershipStatsRow stats={stats} />}

      <div className="mb-4 flex items-center gap-2 rounded-card border border-[#e7e5e4] bg-white p-2">
        {(
          [
            { key: "overview" as Tab, step: 1, label: "Overview", subtitle: "Permanent video register", count: null },
            { key: "open" as Tab, step: 2, label: "Open", subtitle: "Shared ticket list", count: openRows.length },
            { key: "closed" as Tab, step: 3, label: "Closed & Live", subtitle: "Completed and locked", count: null },
          ]
        ).map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center">
            {i === 2 && <div className="mr-2 h-8 w-px bg-[#e7e5e4]" />}
            <button
              onClick={() => setTab(s.key)}
              className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                tab === s.key ? "bg-brand-50" : "hover:bg-surface"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  tab === s.key ? "bg-brand-600 text-white" : "border-2 border-[#e7e5e4] text-gray-400"
                }`}
              >
                {s.step}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${tab === s.key ? "text-brand-600" : "text-ink"}`}>
                  {s.label}
                </div>
                <div className="text-[11px] text-gray-400">{s.subtitle}</div>
              </div>
              {s.count != null && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                  {s.count}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      <PartnershipFilters
        search={search}
        onSearchChange={setSearch}
        ownerId={ownerId}
        onOwnerChange={setOwnerId}
        productId={productId}
        onProductChange={setProductId}
        platform={platform}
        onPlatformChange={setPlatform}
        contentBucket={contentBucket}
        onContentBucketChange={setContentBucket}
        language={language}
        onLanguageChange={setLanguage}
        category={category}
        onCategoryChange={setCategory}
        products={products}
        users={users}
      />

      {tab === "overview" && (
        <>
          {selectedIds.size > 0 && canTakeAction && (
            <div className="mb-3 flex items-center justify-between rounded-card border border-brand-200 bg-[#f9f8ff] px-4 py-2.5">
              <span className="text-xs font-semibold text-ink">{selectedIds.size} selected</span>
              <button
                onClick={() => setTakeActionIds([...selectedIds])}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
              >
                Take action →
              </button>
            </div>
          )}
          <PartnershipOverviewTable
            rows={overviewRows}
            showCommercial={showCommercial}
            canTakeAction={!!canTakeAction}
            selectedIds={selectedIds}
            onToggleAll={toggleAll}
            onToggleOne={toggleOne}
            onOpen={setDetailTicketId}
            onTakeAction={(ticketId) => setTakeActionIds([ticketId])}
          />
        </>
      )}

      {tab === "open" && user && (
        <PartnershipOpenTable rows={openRows} currentUserId={user.id} currentUserRole={user.role} onOpen={setDetailTicketId} />
      )}

      {tab === "closed" && (
        <PartnershipClosedTable rows={closedRows} showCommercial={showCommercial} onOpen={setDetailTicketId} />
      )}

      {takeActionIds && (
        <TakeActionModal
          ticketIds={takeActionIds}
          videoName={singleTicket?.video_name}
          ownerName={singleTicket?.owner_name}
          onClose={() => setTakeActionIds(null)}
          onDone={() => {
            setSelectedIds(new Set());
            refresh();
          }}
        />
      )}

      {detailTicketId && (
        <TicketDetailDrawer ticketId={detailTicketId} onClose={() => setDetailTicketId(null)} onChanged={refresh} />
      )}
    </div>
  );
}
