import { UserPlus } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";
import { initials, instagramUrl } from "../../lib/format";
import type { SortDirection } from "../../lib/sort";
import { SortableHeader } from "../shared/SortableHeader";
import type { CreatorTableRow } from "../../lib/types";

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

const AVATAR_PALETTE = [
  { bg: "bg-[#fff0ed]", text: "text-[#ca4d43]" },
  { bg: "bg-[#f0eff1]", text: "text-[#6d6972]" },
  { bg: "bg-[#fff5e5]", text: "text-[#a66b14]" },
  { bg: "bg-brand-100", text: "text-brand-600" },
  { bg: "bg-[#eaf8ef]", text: "text-[#238b57]" },
];

export function UnassignedPoolTable({
  creators,
  total,
  limit,
  offset,
  sortBy,
  sortDir,
  onSortChange,
  onPageChange,
  onClaimed,
}: {
  creators: CreatorTableRow[];
  total: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortDir: SortDirection;
  onSortChange: (field: string) => void;
  onPageChange: (offset: number) => void;
  onClaimed: () => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  async function claim(creatorId: number) {
    setClaimError(null);
    setClaimingId(creatorId);
    try {
      await api.post(`/creators/${creatorId}/claim`);
      onClaimed();
    } catch (err: any) {
      setClaimError(err.response?.data?.detail ?? "Could not claim this lead.");
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="dashboard-card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[#e7e5e4] bg-surface px-4 py-2 text-xs text-gray-500">
        <span>Ownerless leads left behind when a user was deactivated — claim one to take it over.</span>
        {claimError && <span className="text-[#cf4e43]">{claimError}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e7e5e4] bg-surface text-left">
              <SortableHeader label="Creator" field="name" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={`${TH} pl-4`} />
              <SortableHeader label="Last stage" field="current_stage" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={TH} />
              <SortableHeader label="Videos" field="videos_delivered" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={TH} />
              <SortableHeader label="Last cost" field="last_cost" activeField={sortBy} direction={sortDir} onSort={onSortChange} className={TH} />
              <th className="w-24 py-2.5 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {creators.map((creator) => {
              const avatar = AVATAR_PALETTE[creator.id % AVATAR_PALETTE.length];
              return (
                <tr key={creator.id} className="border-t border-gray-100">
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[9px] text-[8px] font-extrabold ${avatar.bg} ${avatar.text}`}
                      >
                        {initials(creator.name)}
                      </div>
                      <div>
                        <span className="text-[9px] font-extrabold text-ink">{creator.name}</span>
                        <a
                          href={instagramUrl(creator.instagram_handle)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="block text-[7px] text-[#97939d] hover:text-brand-600 hover:underline"
                        >
                          @{creator.instagram_handle}
                        </a>
                      </div>
                    </div>
                  </td>
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
                  <td className="py-2.5 pr-4">
                    <button
                      onClick={() => claim(creator.id)}
                      disabled={claimingId === creator.id}
                      className="flex items-center gap-1.5 rounded-lg border border-[#c8c6f5] bg-white px-3 py-1.5 text-[8px] font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
                    >
                      <UserPlus size={12} />
                      {claimingId === creator.id ? "Claiming..." : "Claim"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {creators.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-gray-400">
                  No unassigned leads right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500">
        <span>
          Showing {creators.length} of {total} unassigned leads
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
