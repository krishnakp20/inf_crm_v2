import { Search } from "lucide-react";
import { PLATFORM_OPTIONS } from "../../lib/campaign-stages";
import type { ContentBucket, CreatorCategoryTier, Language, Platform, Product, User } from "../../lib/types";

export function PartnershipFilters({
  search,
  onSearchChange,
  ownerId,
  onOwnerChange,
  productId,
  onProductChange,
  platform,
  onPlatformChange,
  contentBucket,
  onContentBucketChange,
  language,
  onLanguageChange,
  category,
  onCategoryChange,
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
  platform: Platform | "";
  onPlatformChange: (value: Platform | "") => void;
  contentBucket: string;
  onContentBucketChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  products: Product[];
  users: User[];
  contentBuckets: ContentBucket[];
  languages: Language[];
  categories: CreatorCategoryTier[];
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

      <select
        value={ownerId}
        onChange={(e) => onOwnerChange(e.target.value)}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
      >
        <option value="">All users</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
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
        value={contentBucket}
        onChange={(e) => onContentBucketChange(e.target.value)}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
      >
        <option value="">All content buckets</option>
        {contentBuckets.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
      </select>
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
      >
        <option value="">All languages</option>
        {languages.map((l) => (
          <option key={l.id} value={l.name}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
