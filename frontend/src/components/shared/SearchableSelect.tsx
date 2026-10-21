import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Drop-in replacement for a native filter <select> that adds a search box to the list.
 * `className` styles the trigger button, so it can match whichever filter bar it sits in.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  className = "",
  ariaLabel,
  searchPlaceholder = "Search...",
  align = "left",
  fullWidth = false,
  wrapperClassName = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  ariaLabel?: string;
  searchPlaceholder?: string;
  align?: "left" | "right";
  /** Fill the width of the parent (form fields). `wrapperClassName` carries spacing such as `mb-3`. */
  fullWidth?: boolean;
  wrapperClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(Math.max(0, options.findIndex((o) => o.value === value)));
    searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight].value);
    }
  }

  return (
    <div ref={ref} className={`relative ${fullWidth ? "block w-full" : "inline-block"} ${wrapperClassName}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-1.5 text-left ${fullWidth ? "w-full" : ""} ${className}`}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown size={12} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        <div
          onKeyDown={handleKeyDown}
          className={`absolute top-full z-30 mt-1 ${fullWidth ? "w-full min-w-[200px]" : "w-56"} rounded-[10px] border border-[#e7e5e4] bg-white p-1.5 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-1 flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e7e5e4] px-2">
            <Search size={12} className="shrink-0 text-gray-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-xs font-normal text-ink placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto">
            {filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(o.value)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-semibold normal-case tracking-normal ${
                  i === highlight ? "bg-surface" : ""
                } ${o.value === value ? "text-brand-600" : "text-ink"}`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check size={12} className="shrink-0" />}
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2 py-2 text-xs font-normal text-gray-400">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
