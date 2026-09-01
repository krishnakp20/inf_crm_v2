import { Copy, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { COLLAB_STAGE_ORDER } from "../../lib/collab-stages";
import { initials } from "../../lib/format";
import type { Collaboration, CollabStage } from "../../lib/types";

function formatCredit(credit: number): string {
  return credit.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

const PRIORITY_STYLES: Record<string, { label: string; className: string } | null> = {
  priority: { label: "HIGH", className: "bg-[#fff0ed] text-[#cf4e43]" },
  active: { label: "MEDIUM", className: "bg-[#fff5e5] text-[#ad7018]" },
  none: { label: "LOW", className: "bg-gray-100 text-gray-500" },
  review_due: { label: "MEDIUM", className: "bg-[#fff5e5] text-[#ad7018]" },
  overdue: { label: "HIGH", className: "bg-[#fff0ed] text-[#cf4e43]" },
  ndr: { label: "HIGH", className: "bg-[#fff0ed] text-[#cf4e43]" },
};

const PAYMENT_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-[#fff5e5] text-[#ad7018]" },
  partial_payment: { label: "Partial Payment", className: "bg-brand-50 text-brand-600" },
  payment_done: { label: "Payment Done", className: "bg-emerald-50 text-emerald-600" },
};

const DEAL_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-600" },
  barter: { label: "Barter", className: "bg-violet-50 text-violet-600" },
};

const CONTENT_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  integrated: { label: "Integrated", className: "bg-cyan-50 text-cyan-600" },
  dedicated: { label: "Dedicated", className: "bg-indigo-50 text-indigo-600" },
};

const APPROVAL_SHIELD_STYLES: Record<string, string> = {
  pending: "text-amber-500 hover:text-amber-600",
  approved: "text-emerald-500 hover:text-emerald-600",
  rejected: "text-red-500 hover:text-red-600",
};

function approvalShieldTitle(collab: Collaboration): string {
  if (collab.approval_status === "pending") {
    return `Pending approval · ${collab.approval_target === "supervisor" ? "Supervisor" : "Admin"}`;
  }
  if (collab.approval_status === "approved") return "Approval approved";
  if (collab.approval_status === "rejected") return "Approval rejected";
  return "Request approval";
}

export function CollabKanbanCard({
  collab,
  nextStage,
  onAdvance,
  onOpenDetail,
  onRequestApproval,
  onClone,
  compact = false,
}: {
  collab: Collaboration;
  nextStage: CollabStage | null;
  onAdvance: (collabId: number, nextStage: CollabStage) => void;
  onOpenDetail: (collabId: number) => void;
  onRequestApproval: (collab: Collaboration) => void;
  onClone: (collabId: number) => Promise<void>;
  compact?: boolean;
}) {
  const priority = PRIORITY_STYLES[collab.priority];
  const isDead = collab.stage === "dead_leads";
  const [cloning, setCloning] = useState(false);

  return (
    <div
      onClick={() => onOpenDetail(collab.id)}
      className={`dashboard-card cursor-pointer p-3 hover:border-brand-100 ${isDead ? "opacity-50" : ""}`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-400">{collab.collab_code}</span>
        <div className="flex items-center gap-1">
          {priority && (
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold ${priority.className}`}>
              {priority.label}
            </span>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (cloning) return;
              setCloning(true);
              try {
                await onClone(collab.id);
              } finally {
                setCloning(false);
              }
            }}
            disabled={cloning}
            title="Clone this card for another deliverable from the same creator"
            className="flex h-5 w-5 items-center justify-center rounded text-gray-300 hover:bg-surface hover:text-brand-600 disabled:opacity-50"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestApproval(collab);
            }}
            title={approvalShieldTitle(collab)}
            className={`flex h-5 w-5 items-center justify-center rounded hover:bg-surface ${
              collab.approval_status
                ? APPROVAL_SHIELD_STYLES[collab.approval_status]
                : "text-gray-300 hover:text-brand-600"
            }`}
          >
            <ShieldCheck size={12} />
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600">
          {initials(collab.creator_name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-ink">{collab.creator_name}</div>
          <div className="truncate text-xs text-gray-500">@{collab.creator_handle}</div>
        </div>
      </div>

      {!compact && (
        <div className="mt-2 text-[11px] text-gray-400">
          {collab.creator_total_collabs} collab{collab.creator_total_collabs !== 1 ? "s" : ""} ·{" "}
          {collab.creator_videos_live} video{collab.creator_videos_live !== 1 ? "s" : ""} live
          {collab.commercial_amount != null && (
            <span className="ml-1 font-semibold text-ink">· ₹{collab.commercial_amount.toLocaleString()} locked</span>
          )}
        </div>
      )}

      {!compact && collab.note && <div className="mt-1.5 text-xs text-gray-500">{collab.note}</div>}

      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {collab.products.map((p) => (
            <span
              key={p.product_id}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
            >
              {p.product_name}
              {p.variant_name ? ` — ${p.variant_name}` : ""}
              {collab.stage === "live" && p.is_live_attributed && p.credit != null && p.credit < 1
                ? ` ${formatCredit(p.credit)}`
                : ""}
            </span>
          ))}
          {collab.deal_type && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DEAL_TYPE_STYLES[collab.deal_type].className}`}
            >
              {DEAL_TYPE_STYLES[collab.deal_type].label}
            </span>
          )}
          {collab.content_type && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CONTENT_TYPE_STYLES[collab.content_type].className}`}
            >
              {CONTENT_TYPE_STYLES[collab.content_type].label}
            </span>
          )}
          {collab.is_overdue && (
            <span className="rounded-full bg-[#fff0ed] px-2 py-0.5 text-[10px] font-bold text-[#cf4e43]">Overdue</span>
          )}
          {collab.ownership_revoked_at && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
              Auto-archived
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${PAYMENT_STYLES[collab.payment_status].className}`}
        >
          {PAYMENT_STYLES[collab.payment_status].label}
        </span>
        {collab.ownership_revoked_at ? (
          <span
            title="Ownership auto-revoked by dead zone automation"
            className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-50 text-[10px] font-bold text-gray-300"
          >
            —
          </span>
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[8px] font-bold text-gray-500">
            {initials(collab.owner_name)}
          </span>
        )}
      </div>

      {isDead && (
        <div className="mt-2 rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-500">Dead lead</div>
      )}

      {nextStage && !isDead && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdvance(collab.id, nextStage);
          }}
          className="mt-3 w-full rounded-lg border border-brand-100 bg-brand-50 px-2 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100"
        >
          Move forward
        </button>
      )}
      <select
        value=""
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          if (e.target.value) onAdvance(collab.id, e.target.value as CollabStage);
        }}
        className="mt-2 w-full rounded-lg border border-[#e7e5e4] bg-white px-2 py-1.5 text-xs text-gray-500"
      >
        <option value="">Jump to stage...</option>
        {COLLAB_STAGE_ORDER.filter((s) => s.key !== collab.stage).map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
