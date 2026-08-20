import { initials, roleLabel } from "../../lib/format";
import type { PartnershipRemark, UserRole } from "../../lib/types";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RemarkTimeline({ remarks }: { remarks: PartnershipRemark[] }) {
  if (remarks.length === 0) {
    return <p className="text-xs text-gray-400">No remarks yet.</p>;
  }

  // Remarks arrive newest-first from the API; show oldest-first for a
  // natural top-to-bottom reading order in the timeline.
  const ordered = [...remarks].reverse();

  return (
    <div className="flex flex-col gap-3">
      {ordered.map((remark) => (
        <div key={remark.id} className="flex items-start gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[9px] font-extrabold text-brand-600">
            {initials(remark.author_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-ink">{remark.author_name}</span>
              <span className="text-xs text-gray-400">· {roleLabel(remark.author_role as UserRole)}</span>
              {remark.tag && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{remark.tag}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-600">{remark.body}</p>
            <div className="mt-0.5 text-[11px] text-gray-400">{formatTimestamp(remark.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
