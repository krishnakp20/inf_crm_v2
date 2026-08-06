import { ArrowRight, type LucideIcon } from "lucide-react";

const TONE_STYLES: Record<string, { iconBg: string; iconFg: string; meta: string }> = {
  indigo: { iconBg: "bg-brand-100", iconFg: "text-brand-600", meta: "text-brand-600" },
  green: { iconBg: "bg-[#eaf8ef]", iconFg: "text-[#238b57]", meta: "text-[#238b57]" },
  amber: { iconBg: "bg-[#fff5e5]", iconFg: "text-[#b77818]", meta: "text-[#ad7018]" },
  coral: { iconBg: "bg-[#fff0ed]", iconFg: "text-[#f06e62]", meta: "text-[#f06e62]" },
};

export function KpiCard({
  label,
  value,
  meta,
  subtext,
  icon: Icon,
  tone = "indigo",
}: {
  label: string;
  value: string | number;
  meta?: string;
  subtext?: string;
  icon?: LucideIcon;
  tone?: "indigo" | "green" | "amber" | "coral";
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="dashboard-card p-[14px_15px]">
      {Icon && (
        <div className="mb-3 flex items-center justify-between">
          <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg ${styles.iconBg} ${styles.iconFg}`}>
            <Icon size={18} />
          </div>
          <button
            aria-label={`View ${label}`}
            className="flex h-[27px] w-[27px] items-center justify-center rounded-lg text-[#aaa6af] hover:bg-surface hover:text-brand-600"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="text-[10px] font-semibold text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[25px] font-bold text-ink">{value}</span>
        {meta && <span className={`text-[8px] font-extrabold ${styles.meta}`}>{meta}</span>}
      </div>
      {subtext && <div className="mt-1 text-[8px] text-[#9b97a1]">{subtext}</div>}
    </div>
  );
}
