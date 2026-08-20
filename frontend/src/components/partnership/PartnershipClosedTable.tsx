import { useSort } from "../../hooks/useSort";
import { formatCurrency, initials } from "../../lib/format";
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
    case "owner_name":
      return row.owner_name;
    case "ad_code":
      return row.ad_code;
    case "ad_right_duration_days":
      return row.ad_right_duration_days;
    case "ad_rights_amount":
      return row.ad_rights_amount;
    default:
      return null;
  }
}

export function PartnershipClosedTable({
  rows,
  showCommercial,
  onOpen,
}: {
  rows: PartnershipOverviewRow[];
  showCommercial: boolean;
  onOpen: (ticketId: number) => void;
}) {
  const { sorted, field, direction, toggle } = useSort(rows, getValue);
  return (
    <div className="dashboard-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-max">
          <thead>
            <tr className="border-b border-[#e7e5e4] bg-[#fbfbfc] text-left">
              <SortableHeader label="Video name" field="video_name" activeField={field} direction={direction} onSort={toggle} className={`${TH} pl-4`} />
              <SortableHeader label="POC code" field="poc_code" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Owner" field="owner_name" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Ad code" field="ad_code" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Ad right & time" field="ad_right_duration_days" activeField={field} direction={direction} onSort={toggle} className={TH} />
              {showCommercial && (
                <SortableHeader label="Locked amount" field="ad_rights_amount" activeField={field} direction={direction} onSort={toggle} className={TH} />
              )}
              <th className={TH}>CTA link</th>
              <th className="w-20 py-3 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.ticket_id} className="border-t border-[#efedeb] hover:bg-surface/60">
                <td className="whitespace-nowrap py-3.5 pl-4 pr-6">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-100 text-[9px] font-extrabold text-brand-600">
                      {initials(row.video_name)}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-ink">{row.video_name}</div>
                      <div className="text-[9px] text-[#716d78]">@{row.creator_handle}</div>
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
                  <div className="flex items-center gap-1.5">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-[9px] font-extrabold text-brand-600">
                      {initials(row.owner_name)}
                    </div>
                    <span>{row.owner_name}</span>
                  </div>
                </td>
                <td className={TD}>
                  {row.ad_code ? (
                    <span className={`${CHIP} bg-[#f1f1ff] font-mono text-[#3f428f]`}>{row.ad_code}</span>
                  ) : (
                    <span className="text-[#97939d]">—</span>
                  )}
                </td>
                <td className={TD}>
                  {row.ad_right_duration_days ? `${row.ad_right_duration_days}d · exp ${formatDate(row.ad_right_expires_at)}` : "—"}
                </td>
                {showCommercial && <td className={`${TD} font-semibold`}>{formatCurrency(row.ad_rights_amount)}</td>}
                <td className={TD}>
                  {row.cta_link ? (
                    <a href={row.cta_link} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">
                      Open link
                    </a>
                  ) : (
                    <span className="text-[#97939d]">—</span>
                  )}
                </td>
                <td className="py-3.5 pr-4">
                  <button
                    onClick={() => onOpen(row.ticket_id)}
                    className="rounded-md border border-[#dfe0e6] bg-white px-2.5 py-1.5 text-[9px] font-bold text-[#464957] hover:bg-surface"
                  >
                    View →
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-sm text-gray-400">
                  No closed tickets yet.
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
