import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { DateRangePicker, type RangePreset } from "../dashboard/DateRangePicker";
import { PLATFORM_OPTIONS } from "../../lib/campaign-stages";
import { TICKET_STATUS_LABELS } from "../../lib/partnership-stages";
import { SearchableSelect } from "../shared/SearchableSelect";
import type { ContentBucket, ContentCategory, Language, Platform, Product, TicketStatus, User } from "../../lib/types";

const TICKET_STATUS_OPTIONS = (Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((key) => ({
  value: key,
  label: TICKET_STATUS_LABELS[key],
}));

/** Min / Max comment boxes. Typing waits a moment before filtering, so the list isn't reloaded on every keystroke. */
function CommentsRange({
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);
  useEffect(() => setLocalMin(min), [min]);
  useEffect(() => setLocalMax(max), [max]);
  useEffect(() => {
    if (localMin === min && localMax === max) return;
    const timer = setTimeout(() => {
      if (localMin !== min) onMinChange(localMin);
      if (localMax !== max) onMaxChange(localMax);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMin, localMax]);

  const box =
    "h-7 w-[58px] rounded-md border border-[#e7e5e4] bg-white px-1.5 text-xs font-semibold text-ink placeholder:font-normal placeholder:text-gray-400 focus:outline-none";
  return (
    <div className="flex h-9 items-center gap-1.5 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5">
      <span className="text-xs font-semibold text-ink">Comments</span>
      <input
        type="number"
        min={0}
        aria-label="Minimum comments"
        placeholder="Min"
        value={localMin}
        onChange={(e) => setLocalMin(e.target.value)}
        className={box}
      />
      <span className="text-xs text-gray-400">–</span>
      <input
        type="number"
        min={0}
        aria-label="Maximum comments"
        placeholder="Max"
        value={localMax}
        onChange={(e) => setLocalMax(e.target.value)}
        className={box}
      />
    </div>
  );
}

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
  ticketStatus,
  onTicketStatusChange,
  commentsMin,
  onCommentsMinChange,
  commentsMax,
  onCommentsMaxChange,
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
  ticketStatus: TicketStatus | "";
  onTicketStatusChange: (value: TicketStatus | "") => void;
  commentsMin: string;
  onCommentsMinChange: (value: string) => void;
  commentsMax: string;
  onCommentsMaxChange: (value: string) => void;
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

      <SearchableSelect
        ariaLabel="Filter by ticket status"
        value={ticketStatus}
        onChange={(v) => onTicketStatusChange(v as TicketStatus | "")}
        className={"h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"}
        options={[{ value: "", label: "All ticket statuses" }, ...TICKET_STATUS_OPTIONS]}
      />

      <CommentsRange min={commentsMin} max={commentsMax} onMinChange={onCommentsMinChange} onMaxChange={onCommentsMaxChange} />
    </div>
  );
}
