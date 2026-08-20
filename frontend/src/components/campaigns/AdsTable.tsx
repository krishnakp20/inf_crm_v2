import { useSort } from "../../hooks/useSort";
import { PLATFORM_LABELS } from "../../lib/campaign-stages";
import { compactNumber, initials } from "../../lib/format";
import { SortableHeader } from "../shared/SortableHeader";
import type { CampaignAd } from "../../lib/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const TH = "py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]";

function getValue(ad: CampaignAd, field: string): unknown {
  switch (field) {
    case "collab_code":
      return ad.collab_code;
    case "campaign_name":
      return ad.campaign_name;
    case "product":
      return ad.product_names.join(", ");
    case "platform":
      return ad.platform ? PLATFORM_LABELS[ad.platform] : null;
    case "owner_name":
      return ad.owner_name;
    case "live_date":
      return ad.live_date;
    case "views_count":
      return ad.views_count;
    case "comments_count":
      return ad.comments_count;
    default:
      return null;
  }
}

export function AdsTable({ ads }: { ads: CampaignAd[] }) {
  const { sorted, field, direction, toggle } = useSort(ads, getValue);

  return (
    <div className="dashboard-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e7e5e4] bg-surface text-left">
              <SortableHeader label="Live video" field="collab_code" activeField={field} direction={direction} onSort={toggle} className={`${TH} pl-4`} />
              <SortableHeader label="Campaign" field="campaign_name" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Product" field="product" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Platform" field="platform" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Owner at Live" field="owner_name" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Live date" field="live_date" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Views" field="views_count" activeField={field} direction={direction} onSort={toggle} className={TH} />
              <SortableHeader label="Comments" field="comments_count" activeField={field} direction={direction} onSort={toggle} className={`${TH} pr-4`} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((ad) => (
              <tr key={ad.collab_id} className="border-t border-gray-100">
                <td className="py-2.5 pl-4">
                  <div className="text-[9px] font-extrabold text-ink">{ad.collab_code}</div>
                </td>
                <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">{ad.campaign_name}</td>
                <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{ad.product_names.join(", ") || "—"}</td>
                <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">
                  {ad.platform ? PLATFORM_LABELS[ad.platform] : "—"}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[7px] font-extrabold text-brand-600">
                      {initials(ad.owner_name)}
                    </div>
                    <span className="text-[8px] font-semibold text-[#55515c]">{ad.owner_name}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{formatDate(ad.live_date)}</td>
                <td className="py-2.5 pr-3 text-[8px] font-semibold text-[#55515c]">
                  {ad.views_count != null ? compactNumber(ad.views_count) : "—"}
                </td>
                <td className="py-2.5 pr-4 text-[8px] font-semibold text-[#55515c]">
                  {ad.comments_count != null ? ad.comments_count.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {ads.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-sm text-gray-400">
                  No live ads match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 text-xs text-gray-500">Showing all {ads.length} matching ads</div>
    </div>
  );
}
