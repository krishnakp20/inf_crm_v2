import { useSort } from "../../hooks/useSort";
import { initials } from "../../lib/format";
import { AGING_BADGE, COLLAB_STATUS_LABELS, TICKET_STATUS_BADGE, TICKET_STATUS_LABELS } from "../../lib/partnership-stages";
import { SortableHeader } from "../shared/SortableHeader";
import type { PartnershipOpenRow, UserRole } from "../../lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const TH = "whitespace-nowrap py-3 text-[9px] font-extrabold uppercase tracking-wide text-[#838590]";
const TD = "whitespace-nowrap py-3.5 pr-6 text-[11px] text-[#474a58]";
const CHIP = "whitespace-nowrap rounded-md px-1.5 py-1 text-[9px]";

function getValue(row: PartnershipOpenRow, field: string): unknown {
  switch (field) {
    case "video_name":
      return row.video_name;
    case "poc_code":
      return row.poc_code;
    case "owner_name":
      return row.owner_name;
    case "requested":
      return row.requested.join(", ");
    case "ticket_status":
      return TICKET_STATUS_LABELS[row.ticket_status];
    case "collab_status":
      return COLLAB_STATUS_LABELS[row.collab_status];
    case "aging_days":
      return row.aging_days;
    case "response_due_at":
      return row.response_due_at;
    case "latest_remark":
      return row.latest_remark;
    default:
      return null;
  }
}

export function PartnershipOpenTable({
  rows,
  currentUserId,
  currentUserRole,
  onOpen,
}: {
  rows: PartnershipOpenRow[];
  currentUserId: number;
  currentUserRole: UserRole;
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
              <SortableHeader label="Requested" field="requested" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Ticket status" field="ticket_status" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Collab status" field="collab_status" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Aging" field="aging_days" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Due" field="response_due_at" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Latest remark" field="latest_remark" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <th className="w-28 py-3 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const badge = TICKET_STATUS_BADGE[row.ticket_status];
              const isMine =
                row.ticket_status === "pending_at_user" &&
                (currentUserRole === "advisor" ? row.owner_id === currentUserId : currentUserRole === "editor");
              const isAdminReview = row.ticket_status === "pending_at_admin" && currentUserRole === "admin";
              return (
                <tr key={row.ticket_id} className="border-t border-[#efedeb] hover:bg-surface/60">
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
                  <td className={TD}>{row.requested.join(", ") || "—"}</td>
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
                    {row.aging_bucket ? (
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${AGING_BADGE[row.aging_bucket] ?? ""}`}
                      >
                        {row.aging_bucket} · {row.aging_days}d
                      </span>
                    ) : (
                      <span className="text-[#97939d]">—</span>
                    )}
                  </td>
                  <td className={TD}>{formatDate(row.response_due_at)}</td>
                  <td className={TD}>
                    {row.latest_remark ? (
                      <div className="max-w-[200px] truncate">{row.latest_remark}</div>
                    ) : (
                      <span className="text-[#97939d]">No remarks</span>
                    )}
                  </td>
                  <td className="py-3.5 pr-4">
                    {isAdminReview ? (
                      <button
                        onClick={() => onOpen(row.ticket_id)}
                        className="rounded-md bg-brand-600 px-2.5 py-1.5 text-[9px] font-bold text-white hover:bg-brand-700"
                      >
                        Review →
                      </button>
                    ) : isMine ? (
                      <button
                        onClick={() => onOpen(row.ticket_id)}
                        className="rounded-md bg-brand-600 px-2.5 py-1.5 text-[9px] font-bold text-white hover:bg-brand-700"
                      >
                        Respond →
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpen(row.ticket_id)}
                        className="rounded-md border border-[#dfe0e6] bg-white px-2.5 py-1.5 text-[9px] font-bold text-[#464957] hover:bg-surface"
                      >
                        View →
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-sm text-gray-400">
                  No open tickets match these filters.
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
