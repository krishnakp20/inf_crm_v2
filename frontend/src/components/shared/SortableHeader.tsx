import type { SortDirection } from "../../lib/sort";

export function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  field: string;
  activeField: string | null;
  direction: SortDirection;
  onSort: (field: string) => void;
  className?: string;
}) {
  const active = activeField === field;
  return (
    <th className={className}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 hover:text-ink">
        {label}
        <span className={active ? "text-brand-600" : "text-gray-300"}>
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
