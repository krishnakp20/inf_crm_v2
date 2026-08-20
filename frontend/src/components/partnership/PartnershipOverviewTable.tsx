import { useSort } from "../../hooks/useSort";
import { compactNumber, formatCurrency, initials } from "../../lib/format";
import { PLATFORM_LABELS } from "../../lib/campaign-stages";
import { COLLAB_STATUS_LABELS, TICKET_STATUS_BADGE, TICKET_STATUS_LABELS } from "../../lib/partnership-stages";
import { SortableHeader } from "../shared/SortableHeader";
import type { PartnershipOverviewRow } from "../../lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const TH = "whitespace-nowrap py-3 text-[9px] font-extrabold uppercase tracking-wide text-[#838590]";
const TD = "whitespace-nowrap py-3.5 pr-6 text-[11px] text-[#474a58]";
const CHIP = "whitespace-nowrap rounded-md px-1.5 py-1 text-[9px]";

function getValue(row: PartnershipOverviewRow, field: string): unknown {
  switch (field) {
    case "video_name":
      return row.video_name;
    case "poc_code":
      return row.poc_code;
    case "product":
      return row.product_names.join(", ");
    case "owner_name":
      return row.owner_name;
    case "live_date":
      return row.live_date;
    case "comments_count":
      return row.comments_count;
    case "views_count":
      return row.views_count;
    case "commercial":
      return row.ad_rights_amount ?? row.ad_rights_agent_counter ?? row.ad_rights_creator_quote;
    case "ad_code":
      return row.ad_code;
    case "ad_right_duration_days":
      return row.ad_right_duration_days;
    case "ticket_status":
      return TICKET_STATUS_LABELS[row.ticket_status];
    case "collab_status":
      return COLLAB_STATUS_LABELS[row.collab_status];
    case "latest_remark":
      return row.latest_remark;
    default:
      return null;
  }
}

export function PartnershipOverviewTable({
  rows,
  showCommercial,
  canTakeAction,
  selectedIds,
  onToggleAll,
  onToggleOne,
  onOpen,
  onTakeAction,
}: {
  rows: PartnershipOverviewRow[];
  showCommercial: boolean;
  canTakeAction: boolean;
  selectedIds: Set<number>;
  onToggleAll: () => void;
  onToggleOne: (id: number) => void;
  onOpen: (ticketId: number) => void;
  onTakeAction: (ticketId: number) => void;
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.ticket_id));
  const { sorted, field, direction, toggle } = useSort(rows, getValue);

  return (
    <div className="dashboard-card overflow-hidden p-0">
      {selectedIds.size > 0 && canTakeAction && (
        <div className="flex items-center justify-between border-b border-[#e7e5e4] bg-surface px-4 py-2 text-xs">
          <span className="font-semibold text-ink">
            {selectedIds.size} video{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-max">
          <thead>
            <tr className="border-b border-[#e7e5e4] bg-[#fbfbfc] text-left">
              {canTakeAction && (
                <th className="w-8 py-3 pl-4">
                  <input
                    aria-label="Select all actionable videos"
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="h-3.5 w-3.5 rounded"
                  />
                </th>
              )}
              <SortableHeader label="Video name" field="video_name" activeField={field} direction={direction} onSort={toggle} className={`${TH} pl-4`} />
              <SortableHeader label="POC code" field="poc_code" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Product" field="product" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Owner" field="owner_name" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Live date" field="live_date" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Comments" field="comments_count" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Views" field="views_count" activeField={field} direction={direction} onSort={toggle} className={TH} />
              {showCommercial && (
                <SortableHeader label="Commercial" field="commercial" activeField={field} direction={direction} onSort={toggle} className={TH} />
              )}
              <SortableHeader label="Ad code" field="ad_code" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Ad right & time" field="ad_right_duration_days" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <th className={TH}>CTA link</th>
              <SortableHeader label="Ticket status" field="ticket_status" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Collab status" field="collab_status" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Latest remark" field="latest_remark" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <th className="w-28 py-3 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const badge = TICKET_STATUS_BADGE[row.ticket_status];
              return (
                <tr key={row.ticket_id} className="border-t border-[#efedeb] hover:bg-surface/60">
                  {canTakeAction && (
                    <td className="py-3.5 pl-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.ticket_id)}
                        onChange={() => onToggleOne(row.ticket_id)}
                        className="h-3.5 w-3.5 rounded"
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap py-3.5 pl-4 pr-6">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-100 text-[9px] font-extrabold text-brand-600">
                        {initials(row.video_name)}
                      </div>
                      <div>
                        <button
                          onClick={() => onOpen(row.ticket_id)}
                          className="text-left text-[10px] font-bold text-ink hover:text-brand-600"
                        >
                          {row.video_name}
                        </button>
                        <div className="text-[9px] text-[#716d78]">
                          @{row.creator_handle} · {row.platform ? PLATFORM_LABELS[row.platform] : "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={TD}>
                    {row.poc_code ? (
                      <span className={`${CHIP} bg-[#f1f2f4] font-mono text-[#46495e]`}>{row.poc_code}</span>
                    ) : (
                      <span className="text-[#97939d]">—</span>
                    )}
                  </td>
                  <td className={TD}>
                    {row.product_names.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.product_names.map((name) => (
                          <span key={name} className={`${CHIP} border border-[#e2e3e7] bg-[#fafafa] text-[#5f626e]`}>
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#97939d]">—</span>
                    )}
                  </td>
                  <td className={TD}>
                    <div className="flex items-center gap-1.5">
                      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-[9px] font-extrabold text-brand-600">
                        {initials(row.owner_name)}
                      </div>
                      <span>{row.owner_name}</span>
                    </div>
                  </td>
                  <td className={TD}>{formatDate(row.live_date)}</td>
                  <td className={`${TD} font-semibold`}>{row.comments_count ?? "—"}</td>
                  <td className={`${TD} font-semibold`}>
                    {row.views_count != null ? compactNumber(row.views_count) : "—"}
                  </td>
                  {showCommercial && (
                    <td className={`${TD} font-semibold`}>
                      {formatCurrency(row.ad_rights_amount ?? row.ad_rights_agent_counter ?? row.ad_rights_creator_quote)}
                    </td>
                  )}
                  <td className={TD}>
                    {row.ad_code ? (
                      <span className={`${CHIP} bg-[#f1f1ff] font-mono text-[#3f428f]`}>{row.ad_code}</span>
                    ) : (
                      <span className="text-[#97939d]">Not added</span>
                    )}
                  </td>
                  <td className={TD}>
                    {row.ad_right_duration_days ? (
                      <>
                        <div className="font-semibold">{row.ad_right_duration_days} days</div>
                        <div className="text-[9px] text-[#97939d]">Expires {formatDate(row.ad_right_expires_at)}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={TD}>
                    {row.cta_link ? (
                      <a href={row.cta_link} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">
                        Open link
                      </a>
                    ) : (
                      <span className="text-[#97939d]">—</span>
                    )}
                  </td>
                  <td className={TD}>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${badge}`}>
                      {TICKET_STATUS_LABELS[row.ticket_status]}
                    </span>
                  </td>
                  <td className={TD}>
                    <span className={`${CHIP} border border-[#e0e1e6] bg-white font-extrabold text-[#585b68]`}>
                      {COLLAB_STATUS_LABELS[row.collab_status]}
                    </span>
                  </td>
                  <td className={TD}>
                    {row.latest_remark ? (
                      <>
                        <div className="max-w-[200px] truncate">{row.latest_remark}</div>
                        <div className="text-[9px] text-[#97939d]">
                          {row.latest_remark_author} · {row.remark_count} update{row.remark_count !== 1 ? "s" : ""} →
                        </div>
                      </>
                    ) : (
                      <span className="text-[#97939d]">No remarks</span>
                    )}
                  </td>
                  <td className="py-3.5 pr-4">
                    {row.ticket_status === "closed_and_live" ? (
                      <span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[9px] font-bold text-emerald-600">
                        Closed &amp; Live
                      </span>
                    ) : row.remark_count === 0 && canTakeAction ? (
                      <button
                        onClick={() => onTakeAction(row.ticket_id)}
                        className="rounded-md bg-brand-600 px-2.5 py-1.5 text-[9px] font-bold text-white hover:bg-brand-700"
                      >
                        Take action
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpen(row.ticket_id)}
                        className="rounded-md border border-[#dfe0e6] bg-white px-2.5 py-1.5 text-[9px] font-bold text-[#464957] hover:bg-surface"
                      >
                        View ticket →
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={15} className="py-6 text-center text-sm text-gray-400">
                  No videos match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 text-xs text-gray-500">{rows.length} records</div>
    </div>
  );
}
