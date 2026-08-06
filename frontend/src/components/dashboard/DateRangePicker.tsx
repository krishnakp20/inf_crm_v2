import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type RangePreset = "today" | "7d" | "30d" | "custom";

const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Custom range",
};

export function DateRangePicker({
  preset,
  customFrom,
  customTo,
  onSelectPreset,
  onApplyCustom,
}: {
  preset: RangePreset;
  customFrom: string;
  customTo: string;
  onSelectPreset: (preset: RangePreset) => void;
  onApplyCustom: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(customFrom);
  const [to, setTo] = useState(customTo);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-surface"
      >
        <CalendarDays size={14} />
        {PRESET_LABELS[preset]}
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-card border border-[#e7e5e4] bg-white p-1.5 shadow-lg">
          {(["today", "7d", "30d"] as RangePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                onSelectPreset(p);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold ${
                preset === p ? "bg-brand-100 text-brand-600" : "text-ink hover:bg-surface"
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
          <div className="mt-1 border-t border-[#e7e5e4] pt-2">
            <div className="mb-1.5 text-xs font-bold text-ink">Custom range</div>
            <label className="mb-1.5 flex items-center justify-between text-[11px] text-gray-500">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="ml-2 rounded-md border border-[#e7e5e4] px-1.5 py-1 text-xs"
              />
            </label>
            <label className="mb-2 flex items-center justify-between text-[11px] text-gray-500">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="ml-2 rounded-md border border-[#e7e5e4] px-1.5 py-1 text-xs"
              />
            </label>
            <button
              disabled={!from || !to}
              onClick={() => {
                onApplyCustom(from, to);
                setOpen(false);
              }}
              className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              Apply range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
