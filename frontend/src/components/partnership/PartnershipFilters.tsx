import { Search } from "lucide-react";
import { DateRangePicker, type RangePreset } from "../dashboard/DateRangePicker";
import { PLATFORM_OPTIONS } from "../../lib/campaign-stages";
import { SearchableSelect } from "../shared/SearchableSelect";
import type { ContentBucket, ContentCategory, Language, Platform, Product, User } from "../../lib/types";

export function PartnershipFilters({
  search,
  onSearchChange,
  ownerId,
  onOwnerChange,
  productId,
  onProductChange,
  productGroup,
  onProductGroupChange,
  platform,
  onPlatformChange,
  contentBucket,
  onContentBucketChange,
  language,
  onLanguageChange,
  category,
  onCategoryChange,
  rangePreset,
  customFrom,
  customTo,
  onSelectPreset,
  onApplyCustom,
  products,
  users,
  contentBuckets,
  languages,
  categories,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  ownerId: string;
  onOwnerChange: (value: string) => void;
  productId: string;
  onProductChange: (value: string) => void;
  productGroup: string;
  onProductGroupChange: (value: string) => void;
  platform: Platform | "";
  onPlatformChange: (value: Platform | "") => void;
  contentBucket: string;
  onContentBucketChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  rangePreset: RangePreset;
  customFrom: string;
  customTo: string;
  onSelectPreset: (preset: RangePreset) => void;
  onApplyCustom: (from: string, to: string) => void;
  products: Product[];
  users: User[];
  contentBuckets: ContentBucket[];
  languages: Language[];
  categories: ContentCategory[];
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <div className="flex h-9 w-full max-w-[260px] items-center gap-2 rounded-[9px] border border-[#e7e5e4] bg-white px-2.5">
        <Search size={14} className="shrink-0 text-gray-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search overview..."
          className="w-full text-xs text-ink placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      <DateRangePicker
        preset={rangePreset}
        customFrom={customFrom}
        customTo={customTo}
        onSelectPreset={onSelectPreset}
        onApplyCustom={onApplyCustom}
        align="left"
      />

      <SearchableSelect
        ariaLabel="Filter by user"
        value={ownerId}
        onChange={onOwnerChange}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[
          { value: "", label: "All users" },
          ...users.filter((u) => u.is_active).map((u) => ({ value: String(u.id), label: u.name })),
        ]}
      />

      <SearchableSelect
        ariaLabel="Filter by product group"
        value={productGroup}
        onChange={onProductGroupChange}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[
          { value: "", label: "All product groups" },
          ...[...new Set(products.map((p) => p.parent).filter((g): g is string => !!g))]
            .sort()
            .map((g) => ({ value: g, label: g })),
        ]}
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
        ariaLabel="Filter by content bucket"
        value={contentBucket}
        onChange={onContentBucketChange}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[{ value: "", label: "All content buckets" }, ...contentBuckets.map((b) => ({ value: b.name, label: b.name }))]}
      />

      <SearchableSelect
        ariaLabel="Filter by language"
        value={language}
        onChange={onLanguageChange}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[{ value: "", label: "All languages" }, ...languages.map((l) => ({ value: l.name, label: l.name }))]}
      />

      <SearchableSelect
        ariaLabel="Filter by category"
        value={category}
        onChange={onCategoryChange}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
        options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.name, label: c.name }))]}
      />
    </div>
  );
}
