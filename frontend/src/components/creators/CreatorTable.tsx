import { Eye } from "lucide-react";
import { useState } from "react";
import { compactNumber, initials, instagramUrl, maskPhone } from "../../lib/format";
import type { SortDirection } from "../../lib/sort";
import { SortableHeader } from "../shared/SortableHeader";
import type { CreatorStatus, CreatorTableRow } from "../../lib/types";

const STATUS_STYLES: Record<CreatorStatus, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "rounded-md bg-[#fff0ed] px-1.5 py-0.5 text-[7px] font-extrabold text-[#ca4d43]" },
  priority: { label: "Priority", className: "rounded-md bg-[#fff0ed] px-1.5 py-0.5 text-[7px] font-extrabold text-[#ca4d43]" },
  ndr: { label: "NDR", className: "rounded-md bg-[#fff0ed] px-1.5 py-0.5 text-[7px] font-extrabold text-[#ca4d43]" },
  review_due: { label: "Review due", className: "rounded-md bg-[#eeedff] px-1.5 py-0.5 text-[7px] font-extrabold text-brand-600" },
  partnership: { label: "Partnership", className: "rounded-md bg-[#fff5e5] px-1.5 py-0.5 text-[7px] font-extrabold text-[#a66b14]" },
  active: { label: "Active", className: "text-[8px] font-bold text-[#55515c]" },
  none: { label: "New", className: "rounded-md bg-[#f0eff1] px-1.5 py-0.5 text-[7px] font-extrabold text-[#716d78]" },
};

const AVATAR_PALETTE = [
  { bg: "bg-[#fff0ed]", text: "text-[#ca4d43]" },
  { bg: "bg-[#f0eff1]", text: "text-[#6d6972]" },
  { bg: "bg-[#fff5e5]", text: "text-[#a66b14]" },
  { bg: "bg-brand-100", text: "text-brand-600" },
  { bg: "bg-[#eaf8ef]", text: "text-[#238b57]" },
];

type SortField =
  | "name"
  | "followers_count"
  | "videos_delivered"
  | "last_cost"
  | "last_video_live_at"
  | "comments_count"
  | "created_at"
  | "current_stage";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

export function CreatorTable({
  creators,
  owners,
  total,
  limit,
  offset,
  sortBy,
  sortDir,
  onSortChange,
  onPageChange,
  onView,
}: {
  creators: CreatorTableRow[];
  owners: Record<number, string>;
  total: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortDir: SortDirection;
  onSortChange: (field: SortField) => void;
  onPageChange: (offset: number) => void;
  onView: (creatorId: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

  return (
    <div className="dashboard-card overflow-hidden p-0">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between border-b border-[#e7e5e4] bg-surface px-4 py-2 text-xs">
          <span className="font-semibold text-ink">{selectedIds.size} creator{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <button onClick={() => setSelectedIds(new Set())} className="font-semibold text-brand-600 hover:text-brand-700">
            Clear
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e7e5e4] bg-surface text-left">
              <th className="w-8 py-2.5 pl-4">
                <input
                  aria-label="Select all visible creators"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded"
                />
              </th>
              <SortableHeader label="Creator" field="name" activeField={sortBy} direction={sortDir} onSort={(f) => onSortChange(f as SortField)} className={TH} />
              <th className={TH}>Contact</th>
              <th className={TH}>Category</th>
              <SortableHeader label="Followers" field="followers_count" activeField={sortBy} direction={sortDir} onSort={(f) => onSortChange(f as SortField)} className={TH} />
              <SortableHeader label="Added on" field="created_at" activeField={sortBy} direction={sortDir} onSort={(f) => onSortChange(f as SortField)} className={TH} />
              <SortableHeader label="Videos" field="videos_delivered" activeField={sortBy} direction={sortDir} onSort={(f) => onSortChange(f as SortField)} className={TH} />
              <SortableHeader label="Last cost" field="last_cost" activeField={sortBy} direction={sortDir} onSort={(f) => onSortChange(f as SortField)} className={TH} />
              <SortableHeader label="Last video went live" field="last_video_live_at" activeField={sortBy} direction={sortDir} onSort={(f) => onSortChange(f as SortField)} className={TH} />
              <SortableHeader label="Comments" field="comments_count" activeField={sortBy} direction={sortDir} onSort={(f) => onSortChange(f as SortField)} className={TH} />
              <SortableHeader label="Current stage" field="current_stage" activeField={sortBy} direction={sortDir} onSort={(f) => onSortChange(f as SortField)} className={TH} />
              <th className={TH}>Status</th>
              <th className="w-10 py-2.5 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {creators.map((creator) => {
              const avatar = AVATAR_PALETTE[creator.id % AVATAR_PALETTE.length];
              const ownerName = owners[creator.owner_id] ?? "—";
              const statusStyle = STATUS_STYLES[creator.status];
              return (
                <tr key={creator.id} className={`border-t border-gray-100 ${creator.is_archived ? "opacity-50" : ""}`}>
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
                        <a
                          href={instagramUrl(creator.instagram_handle)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block text-[7px] text-[#97939d] hover:text-brand-600 hover:underline"
                        >
                          @{creator.instagram_handle}
                        </a>
                        <div className="text-[7px] font-semibold text-brand-600">User: {ownerName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="text-[8px] font-semibold text-[#55515c]">{maskPhone(creator.phone)}</div>
                    <div className="text-[7px] text-[#97939d]">WhatsApp connected</div>
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{creator.category}</td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">
                    {compactNumber(creator.followers_count)}
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">
                    {new Date(creator.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="py-2.5 pr-3">
                    <button onClick={() => onView(creator.id)} className="text-left">
                      <div className="text-[8px] font-semibold text-[#55515c]">{creator.videos_delivered}</div>
                      <div className="text-[7px] text-[#97939d]">Delivered</div>
                    </button>
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">
                    {creator.last_cost != null ? `₹${creator.last_cost.toLocaleString()}` : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    {creator.last_video_live_at ? (
                      <>
                        <div className="text-[8px] font-semibold text-[#55515c]">
                          {new Date(creator.last_video_live_at).toLocaleDateString(undefined, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        {creator.last_video_product_name && (
                          <div className="text-[7px] text-[#97939d]">{creator.last_video_product_name}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-[8px] text-[#97939d]">Not live yet</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">{creator.comments_count ?? 0}</td>
                  <td className="py-2.5 pr-3">
                    {creator.current_collab_stage_label ? (
                      <span className="rounded-md bg-[#f0eff3] px-1.5 py-0.5 text-[8px] font-bold text-[#625d69]">
                        {creator.current_collab_stage_label}
                      </span>
                    ) : (
                      <span className="text-[8px] text-[#97939d]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={statusStyle.className}>{statusStyle.label}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <button
                      onClick={() => onView(creator.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface hover:text-brand-600"
                      title={`Open lifecycle for ${creator.name}`}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {creators.length === 0 && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-sm text-gray-400">
                  No creators match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500">
        <span>
          Showing {creators.length} of {total} creators
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
