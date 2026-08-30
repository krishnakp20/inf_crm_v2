import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { initials } from "../../lib/format";
import type { ApprovalRequest } from "../../lib/types";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-[#fff0ed] text-[#cf4e43]",
  normal: "bg-gray-100 text-gray-500",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#fff5e5] text-[#ad7018]",
  approved: "bg-emerald-50 text-emerald-600",
  rejected: "bg-[#fff0ed] text-[#cf4e43]",
};

const PAGE_SIZE = 4;

export function ApprovalRequests({
  requests,
  canApprove,
  onApprove,
  onReject,
}: {
  requests: ApprovalRequest[];
  canApprove: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
}) {
  const [userFilter, setUserFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const users = useMemo(
    () => [...new Set(requests.map((r) => r.requested_by_name))].sort(),
    [requests]
  );
  const filtered = userFilter ? requests.filter((r) => r.requested_by_name === userFilter) : requests;
  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-normal text-ink">{canApprove ? "Approval requests" : "Approval sent"}</h2>
          <p className="mt-1 text-[10px] text-muted">
            {canApprove ? "Leads sent to you for approval" : "Requests you have sent for approval"}
          </p>
        </div>
        {canApprove && users.length > 1 && (
          <select
            aria-label="Filter approval requests by user"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-[#e7e5e4] bg-white px-2 py-1 text-[10px] font-semibold text-ink"
          >
            <option value="">All users</option>
            {users.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {visible.map((req) => (
          <div key={req.id} className="rounded-card border border-[#e7e5e4] p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600">
                {initials(req.creator_name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold text-ink">{req.creator_name}</div>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${PRIORITY_STYLES[req.priority]}`}
                  >
                    {req.priority}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {req.requested_by_name} · {req.collab_stage_label} · Sent to{" "}
                  {req.target === "admin" ? "Admin" : "Supervisor"}
                </div>
                <p className="mt-1.5 text-xs text-gray-600">{req.note}</p>
                <div className="mt-1.5 text-[11px] text-gray-400">
                  {req.request_code} · {new Date(req.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              {canApprove ? (
                <>
                  <Link
                    to="/my-creators"
                    className="rounded-lg border border-[#e7e5e4] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface"
                  >
                    Open lead
                  </Link>
                  <button
                    onClick={() => onApprove?.(req.id)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onReject?.(req.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-400 hover:bg-surface hover:text-[#cf4e43]"
                  >
                    Reject
                  </button>
                </>
              ) : (
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_STYLES[req.status]}`}>
                  {req.status === "pending" ? "Pending" : req.status === "approved" ? "Approved" : "Rejected"}
                </span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400">
            {canApprove ? "No pending approval requests." : "You haven't sent any approval requests."}
          </p>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-[#e7e5e4] pt-3 text-xs">
          <span className="text-gray-500">{filtered.length} pending</span>
          {filtered.length > PAGE_SIZE && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              {showAll ? "Show less" : "Show all"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
