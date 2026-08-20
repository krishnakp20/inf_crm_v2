import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { SortableHeader } from "../shared/SortableHeader";
import { useSort } from "../../hooks/useSort";
import { CAMPAIGN_STATUS_BADGE, CAMPAIGN_STATUS_LABELS, PLATFORM_LABELS } from "../../lib/campaign-stages";
import { initials } from "../../lib/format";
import type { CampaignListItem } from "../../lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

function getValue(c: CampaignListItem, field: string): unknown {
  switch (field) {
    case "name":
      return c.name;
    case "status":
      return c.status;
    case "deadline":
      return c.deadline;
    case "products":
      return c.product_names.join(", ");
    case "participant_count":
      return c.participant_count;
    case "committed":
      return c.committed;
    case "unassigned":
      return c.unassigned;
    case "live_ads_count":
      return c.live_ads_count;
    case "progress_pct":
      return c.progress_pct;
    case "creators_needed":
      return c.creators_needed;
    default:
      return null;
  }
}

export function CampaignTable({
  campaigns,
  onOpen,
}: {
  campaigns: CampaignListItem[];
  onOpen: (campaignId: number) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { sorted, field, direction, toggle } = useSort(campaigns, getValue);
  const allSelected = campaigns.length > 0 && campaigns.every((c) => selectedIds.has(c.id));

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(campaigns.map((c) => c.id)));
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
          <span className="font-semibold text-ink">
            {selectedIds.size} campaign{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
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
                  aria-label="Select all filtered campaigns"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded"
                />
              </th>
              <SortableHeader label="Campaign" field="name" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Status" field="status" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Deadline" field="deadline" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Products" field="products" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Participants" field="participant_count" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Committed" field="committed" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Unassigned" field="unassigned" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Live ads" field="live_ads_count" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Progress" field="progress_pct" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Creators" field="creators_needed" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <th className="w-8 py-2.5 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const badge = CAMPAIGN_STATUS_BADGE[c.status];
              return (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="py-2.5 pl-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      className="h-3.5 w-3.5 rounded"
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[9px] bg-brand-100 text-[8px] font-extrabold text-brand-600">
                        {initials(c.name)}
                      </div>
                      <div>
                        <button
                          onClick={() => onOpen(c.id)}
                          className="text-left text-[9px] font-extrabold text-ink hover:text-brand-600"
                        >
                          {c.name}
                        </button>
                        <div className="text-[7px] text-[#97939d]">
                          {c.campaign_code} · {c.platforms.map((p) => PLATFORM_LABELS[p]).join(" + ") || "No platform"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${badge}`}>
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{formatDate(c.deadline)}</td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">
                    {c.product_names.length > 0 ? c.product_names.join(", ") : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">
                    {c.participant_count} participating
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">{c.committed}</td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">
                    {c.unassigned > 0 ? `${c.unassigned} open` : "Fully claimed"}
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">{c.live_ads_count}</td>
                  <td className="py-2.5 pr-3">
                    <div className="text-[8px] font-bold text-ink">{c.progress_pct}%</div>
                    <div className="text-[7px] text-[#97939d]">
                      {Math.max(c.target_videos - c.live_ads_count, 0)} campaign videos left
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{c.creators_needed ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <button
                      onClick={() => onOpen(c.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface hover:text-brand-600"
                      title={`Open ${c.name}`}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-sm text-gray-400">
                  No campaigns match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500">
        <span>Showing all {campaigns.length} matching campaigns</span>
      </div>
    </div>
  );
}
