import { Search } from "lucide-react";
import { CAMPAIGN_STATUS_ORDER, PLATFORM_OPTIONS } from "../../lib/campaign-stages";
import { SearchableSelect } from "../shared/SearchableSelect";
import type { CampaignStatus, Platform, Product, User } from "../../lib/types";

export function CampaignFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  productId,
  onProductChange,
  platform,
  onPlatformChange,
  userId,
  onUserChange,
  products,
  users,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: CampaignStatus | "";
  onStatusChange: (value: CampaignStatus | "") => void;
  productId: string;
  onProductChange: (value: string) => void;
  platform: Platform | "";
  onPlatformChange: (value: Platform | "") => void;
  userId: string;
  onUserChange: (value: string) => void;
  products: Product[];
  users: User[];
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <div className="flex h-9 w-full max-w-[300px] items-center gap-2 rounded-[9px] border border-[#e7e5e4] bg-white px-2.5">
        <Search size={14} className="shrink-0 text-gray-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search campaigns..."
          className="w-full text-xs text-ink placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      <SearchableSelect
        ariaLabel="Filter by status"
        value={status}
        onChange={(v) => onStatusChange(v as CampaignStatus | "")}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[{ value: "", label: "All statuses" }, ...CAMPAIGN_STATUS_ORDER.map((s) => ({ value: s.key, label: s.label }))]}
      />

      <SearchableSelect
        ariaLabel="Filter by product"
        value={productId}
        onChange={onProductChange}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[{ value: "", label: "All products" }, ...products.map((p) => ({ value: String(p.id), label: p.name }))]}
      />

      <SearchableSelect
        ariaLabel="Filter by platform"
        value={platform}
        onChange={(v) => onPlatformChange(v as Platform | "")}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[{ value: "", label: "All platforms" }, ...PLATFORM_OPTIONS.map((p) => ({ value: p.key, label: p.label }))]}
      />

      <SearchableSelect
        ariaLabel="Filter by user"
        value={userId}
        onChange={onUserChange}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[{ value: "", label: "All users" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]}
      />
    </div>
  );
}
