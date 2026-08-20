import { Search } from "lucide-react";
import { CAMPAIGN_STATUS_ORDER, PLATFORM_OPTIONS } from "../../lib/campaign-stages";
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

      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as CampaignStatus | "")}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
      >
        <option value="">All statuses</option>
        {CAMPAIGN_STATUS_ORDER.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={productId}
        onChange={(e) => onProductChange(e.target.value)}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
      >
        <option value="">All products</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={platform}
        onChange={(e) => onPlatformChange(e.target.value as Platform | "")}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
      >
        <option value="">All platforms</option>
        {PLATFORM_OPTIONS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        value={userId}
        onChange={(e) => onUserChange(e.target.value)}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
      >
        <option value="">All users</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}
