import type { UserRole } from "../../lib/types";

export type AnalyticsTab = "overall" | "team" | "user";

export function AnalyticsTabs({
  role,
  tab,
  onTabChange,
}: {
  role: UserRole;
  tab: AnalyticsTab;
  onTabChange: (tab: AnalyticsTab) => void;
}) {
  if (role === "marketer" || role === "advisor") return null;

  const firstTab: AnalyticsTab = role === "supervisor" ? "team" : "overall";
  const firstLabel = role === "supervisor" ? "My team" : "Overall";

  return (
    <div className="mb-4 flex items-center gap-4 border-b border-[#e7e5e4] text-sm font-semibold text-gray-400">
      <button
        onClick={() => onTabChange(firstTab)}
        className={`border-b-2 px-1 pb-2 ${tab === firstTab ? "border-brand-600 text-brand-600" : "border-transparent hover:text-ink"}`}
      >
        {firstLabel}
      </button>
      <button
        onClick={() => onTabChange("user")}
        className={`border-b-2 px-1 pb-2 ${tab === "user" ? "border-brand-600 text-brand-600" : "border-transparent hover:text-ink"}`}
      >
        User-wise
      </button>
    </div>
  );
}
