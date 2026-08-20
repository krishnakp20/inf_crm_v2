import { Eye, Users } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";
import { initials } from "../../lib/format";
import type { SortDirection } from "../../lib/sort";
import { SortableHeader } from "../shared/SortableHeader";
import type { CreatorTableRow, User } from "../../lib/types";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

const AVATAR_PALETTE = [
  { bg: "bg-[#fff0ed]", text: "text-[#ca4d43]" },
  { bg: "bg-[#f0eff1]", text: "text-[#6d6972]" },
  { bg: "bg-[#fff5e5]", text: "text-[#a66b14]" },
  { bg: "bg-brand-100", text: "text-brand-600" },
  { bg: "bg-[#eaf8ef]", text: "text-[#238b57]" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function ArchivedLeadsTable({
  creators,
  owners,
  advisors,
  total,
  limit,
  offset,
  sortBy,
  sortDir,
  onSortChange,
  onPageChange,
  onView,
  onAssigned,
}: {
  creators: CreatorTableRow[];
  owners: Record<number, string>;
  advisors: User[];
  total: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortDir: SortDirection;
  onSortChange: (field: string) => void;
  onPageChange: (offset: number) => void;
  onView: (creatorId: number) => void;
  onAssigned: () => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [assignTargetId, setAssignTargetId] = useState<number | "">(advisors[0]?.id ?? "");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const allSelected = creators.length > 0 && creators.every((c) => selectedIds.has(c.id));

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(creators.map((c) => c.id)));
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assignSelected() {
    if (!assignTargetId || selectedIds.size === 0) return;
    setAssignError(null);
    setAssigning(true);
    try {
      await api.post("/creators/bulk-assign", {
        creator_ids: [...selectedIds],
        new_owner_id: assignTargetId,
      });
      setSelectedIds(new Set());
      onAssigned();
    } catch (err: any) {
      setAssignError(err.response?.data?.detail ?? "Could not assign these leads.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="dashboard-card overflow-hidden p-0">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7e5e4] bg-surface px-4 py-2 text-xs">
          <span className="font-semibold text-ink">
            {selectedIds.size} creator{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            {assignError && <span className="text-[#cf4e43]">{assignError}</span>}
            <label className="flex items-center gap-1.5 text-gray-500">
              Assign to
              <select
                value={assignTargetId}
                onChange={(e) => setAssignTargetId(Number(e.target.value))}
                className="rounded-lg border border-[#e7e5e4] bg-white px-2 py-1.5 text-xs font-semibold text-ink"
              >
                {advisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={assignSelected}
              disabled={assigning || !assignTargetId}
              className="flex items-center gap-1.5 rounded-lg border border-[#c8c6f5] bg-white px-3 py-1.5 font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
            >
              <Users size={13} />
              {assigning ? "Assigning..." : "Assign selected"}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e7e5e4] bg-surface text-left">
              <th className="w-8 py-2.5 pl-4">
                <input
                  aria-label="Select all archived leads"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded"
                />
              </th>
              <SortableHeader label="Creator" field="name" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={TH} />
              <th className={TH}>Previous user</th>
              <SortableHeader label="Archived on" field="archived_at" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={TH} />
              <SortableHeader label="Last stage" field="current_stage" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={TH} />
              <SortableHeader label="Videos" field="videos_delivered" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={TH} />
              <SortableHeader label="Last cost" field="last_cost" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={TH} />
              <th className={TH}>Reason</th>
              <th className="w-10 py-2.5 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {creators.map((creator) => {
              const avatar = AVATAR_PALETTE[creator.id % AVATAR_PALETTE.length];
              return (
                <tr key={creator.id} className="border-t border-gray-100">
                  <td className="py-2.5 pl-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(creator.id)}
                      onChange={() => toggleOne(creator.id)}
                      className="h-3.5 w-3.5 rounded"
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[9px] text-[8px] font-extrabold ${avatar.bg} ${avatar.text}`}
                      >
                        {initials(creator.name)}
                      </div>
                      <div>
                        <button
                          onClick={() => onView(creator.id)}
                          className="text-left text-[9px] font-extrabold text-ink hover:text-brand-600"
                        >
                          {creator.name}
                        </button>
                        <div className="text-[7px] text-[#97939d]">@{creator.instagram_handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">
                    {owners[creator.owner_id] ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{formatDate(creator.archived_at)}</td>
                  <td className="py-2.5 pr-3">
                    {creator.current_collab_stage_label ? (
                      <span className="rounded-md bg-[#f0eff3] px-1.5 py-0.5 text-[8px] font-bold text-[#625d69]">
                        {creator.current_collab_stage_label}
                      </span>
                    ) : (
                      <span className="text-[8px] text-[#97939d]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">{creator.videos_delivered}</td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">
                    {creator.last_cost != null ? `₹${creator.last_cost.toLocaleString()}` : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{creator.archive_reason ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <button
                      onClick={() => onView(creator.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface hover:text-brand-600"
                      title={`View archived lifecycle for ${creator.name}`}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {creators.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-sm text-gray-400">
                  No creators found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500">
        <span>
          Showing {creators.length} of {total} archived leads
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={offset === 0}
            onClick={() => onPageChange(Math.max(offset - limit, 0))}
            className="rounded-md border border-gray-200 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => onPageChange(offset + limit)}
            className="rounded-md border border-gray-200 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
