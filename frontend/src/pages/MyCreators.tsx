import { LayoutGrid, List, Plus, Search, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AddCollaborationModal } from "../components/creators/AddCollaborationModal";
import { CollabBoardStatsRow } from "../components/creators/CollabBoardStatsRow";
import { CollabDetailPanel } from "../components/creators/CollabDetailPanel";
import { CollabKanbanBoard } from "../components/creators/CollabKanbanBoard";
import { RequestApprovalModal } from "../components/creators/RequestApprovalModal";
import { SetTargetDrawer } from "../components/creators/SetTargetDrawer";
import { StageMovePrompt } from "../components/creators/StageMovePrompt";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { CollabBoardStats, Collaboration, CollabStage, Product, User } from "../lib/types";

const PRIORITY_FILTERS = [
  { label: "All priorities", value: "" },
  { label: "High", value: "priority" },
  { label: "Medium", value: "active" },
  { label: "Low", value: "none" },
];

const PAYMENT_FILTERS = [
  { label: "All payments", value: "" },
  { label: "Paid", value: "payment_done" },
  { label: "Pending", value: "pending" },
  { label: "Partial", value: "partial_payment" },
];

export default function MyCreators() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | "all" | null>(null);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [stats, setStats] = useState<CollabBoardStats | null>(null);
  const [showAddCollab, setShowAddCollab] = useState(false);
  const [addCardStage, setAddCardStage] = useState<CollabStage | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [detailCollabId, setDetailCollabId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [approvalCollab, setApprovalCollab] = useState<Collaboration | null>(null);
  const [compact, setCompact] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ collabId: number; toStage: CollabStage; missingFields: string[] } | null>(
    null
  );
  const [showSetTarget, setShowSetTarget] = useState(false);

  const advisors = users.filter((u) => u.role === "advisor");
  const activeAdvisors = advisors.filter((a) => a.is_active);
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const canViewTeam = isAdmin || isSupervisor;

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") {
      api.get<User[]>("/users").then((res) => {
        setUsers(res.data);
        const advisorUsers = res.data.filter((u) => u.role === "advisor");
        setSelectedOwnerId(advisorUsers[0]?.id ?? null);
      });
    } else if (user.role === "supervisor") {
      api.get<User[]>("/users").then((res) => {
        const team = res.data.filter((u) => u.role === "advisor" && u.supervisor_id === user.id);
        setUsers(team);
        setSelectedOwnerId("all");
      });
    } else {
      setUsers([user]);
      setSelectedOwnerId(user.id);
    }
    api.get<Product[]>("/products").then((res) => setProducts(res.data));
  }, [user]);

  function loadBoard(ownerId: number | "all") {
    const ownerParam = ownerId === "all" ? undefined : ownerId;
    api
      .get<Collaboration[]>("/collaborations", {
        params: {
          owner_id: ownerParam,
          product_id: productFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 500,
        },
      })
      .then((res) => setCollaborations(res.data));
    api
      .get<CollabBoardStats>("/collaborations/board-stats", { params: { owner_id: ownerParam } })
      .then((res) => setStats(res.data));
  }

  useEffect(() => {
    if (!selectedOwnerId) return;
    loadBoard(selectedOwnerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOwnerId, productFilter, dateFrom, dateTo]);

  const filteredCollaborations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return collaborations.filter((c) => {
      if (priorityFilter && c.priority !== priorityFilter) return false;
      if (paymentFilter && c.payment_status !== paymentFilter) return false;
      if (
        query &&
        !c.creator_name.toLowerCase().includes(query) &&
        !c.creator_handle.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [collaborations, priorityFilter, paymentFilter, searchQuery]);

  if (user && (user.role === "marketer" || user.role === "editor")) {
    return <Navigate to="/" replace />;
  }

  async function handleAdvance(collabId: number, nextStage: CollabStage) {
    try {
      await api.post(`/collaborations/${collabId}/stage`, { to_stage: nextStage });
      if (selectedOwnerId) loadBoard(selectedOwnerId);
    } catch (err: any) {
      const missingFields = err.response?.data?.detail?.missing_fields;
      if (err.response?.status === 400 && Array.isArray(missingFields)) {
        setPendingMove({ collabId, toStage: nextStage, missingFields });
      } else {
        throw err;
      }
    }
  }

  function handleAddCard(stage: CollabStage) {
    setAddCardStage(stage);
    setShowAddCollab(true);
  }

  function handleOpenDetail(collabId: number) {
    setDetailCollabId(collabId);
  }

  const detailCollab = detailCollabId ? collaborations.find((c) => c.id === detailCollabId) ?? null : null;

  return (
    <div>
      <Topbar
        eyebrow="MY WORKSPACE · COLLABORATION KANBAN"
        title="My creators"
        subtitle="One creator username can hold multiple collaboration cards without duplicating the creator record."
        actions={
          <div className="flex gap-2">
            {user?.role === "advisor" && (
              <button
                onClick={() => setShowSetTarget(true)}
                className="flex items-center gap-1.5 rounded-[10px] border border-[#e7e5e4] px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface"
              >
                <Target size={16} />
                Set target
              </button>
            )}
            <button
              onClick={() => {
                setAddCardStage(null);
                setShowAddCollab(true);
              }}
              className="flex items-center gap-1.5 rounded-[10px] bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              Add collaboration
            </button>
          </div>
        }
      />

      {showAddCollab && user && (
        <AddCollaborationModal
          users={activeAdvisors}
          products={products}
          currentUserId={user.id}
          canAssignOwner={canViewTeam}
          defaultOwnerId={typeof selectedOwnerId === "number" ? selectedOwnerId : undefined}
          initialStage={addCardStage ?? undefined}
          onClose={() => setShowAddCollab(false)}
          onCreated={() => selectedOwnerId && loadBoard(selectedOwnerId)}
        />
      )}

      <div className="mb-4 rounded-card border border-[#e7e5e4] bg-surface p-3 text-xs text-gray-500">
        <span className="font-semibold text-ink">Dead zone automation is active</span> — Active cards: 60 days
        without meaningful activity · Live cards: 6 months without meaningful activity · ownership is revoked
        automatically. <span className="font-semibold">Daily check · Asia/Kolkata.</span>
      </div>

      {stats && <CollabBoardStatsRow stats={stats} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-[295px] shrink-0 items-center gap-2 rounded-[9px] border border-[#e7e5e4] bg-white px-2.5">
          <Search size={14} className="shrink-0 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search my creators..."
            className="w-full text-[10px] text-ink placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        {canViewTeam && (
          <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] bg-white px-2">
            <span className="text-[6px] font-extrabold uppercase tracking-wide text-[#99949e]">User</span>
            <select
              value={selectedOwnerId ?? ""}
              onChange={(e) => setSelectedOwnerId(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="bg-transparent text-[8px] font-bold text-ink focus:outline-none"
            >
              <option value="all">All team</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] bg-white px-2">
          <span className="text-[6px] font-extrabold uppercase tracking-wide text-[#99949e]">Priority</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-transparent text-[8px] font-bold text-ink focus:outline-none"
          >
            {PRIORITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] bg-white px-2">
          <span className="text-[6px] font-extrabold uppercase tracking-wide text-[#99949e]">Payment</span>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-transparent text-[8px] font-bold text-ink focus:outline-none"
          >
            {PAYMENT_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] bg-white px-2">
          <span className="text-[6px] font-extrabold uppercase tracking-wide text-[#99949e]">Product</span>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="bg-transparent text-[8px] font-bold text-ink focus:outline-none"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] bg-white px-2">
          <span className="text-[6px] font-extrabold uppercase tracking-wide text-[#99949e]">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[110px] bg-transparent text-[8px] text-ink focus:outline-none"
          />
        </label>

        <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] bg-white px-2">
          <span className="text-[6px] font-extrabold uppercase tracking-wide text-[#99949e]">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[110px] bg-transparent text-[8px] text-ink focus:outline-none"
          />
        </label>

        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#e7e5e4] bg-surface p-0.5">
          <button
            onClick={() => setCompact(false)}
            aria-label="Comfortable cards"
            className={`grid h-7 w-[30px] place-items-center rounded-[6px] ${
              !compact ? "bg-white text-brand-600 shadow-sm" : "text-gray-400"
            }`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setCompact(true)}
            aria-label="Compact cards"
            className={`grid h-7 w-[30px] place-items-center rounded-[6px] ${
              compact ? "bg-white text-brand-600 shadow-sm" : "text-gray-400"
            }`}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      <CollabKanbanBoard
        collaborations={filteredCollaborations}
        onAdvance={handleAdvance}
        onAddCard={handleAddCard}
        onOpenDetail={handleOpenDetail}
        onRequestApproval={setApprovalCollab}
        compact={compact}
      />

      {approvalCollab && (
        <RequestApprovalModal
          collab={approvalCollab}
          onClose={() => setApprovalCollab(null)}
          onSent={() => {}}
        />
      )}

      {detailCollab && (
        <CollabDetailPanel
          collab={detailCollab}
          products={products}
          onClose={() => setDetailCollabId(null)}
          onChanged={() => selectedOwnerId && loadBoard(selectedOwnerId)}
        />
      )}

      {pendingMove && (
        <StageMovePrompt
          collabId={pendingMove.collabId}
          targetStage={pendingMove.toStage}
          missingFields={pendingMove.missingFields}
          linkedProducts={
            collaborations
              .find((c) => c.id === pendingMove.collabId)
              ?.products.map((p) => ({ id: p.product_id, name: p.product_name })) ?? []
          }
          onClose={() => setPendingMove(null)}
          onMoved={() => selectedOwnerId && loadBoard(selectedOwnerId)}
        />
      )}

      {showSetTarget && <SetTargetDrawer products={products} onClose={() => setShowSetTarget(false)} />}
    </div>
  );
}
