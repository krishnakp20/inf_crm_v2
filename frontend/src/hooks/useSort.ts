import { useMemo, useState } from "react";
import { compareValues, type SortDirection } from "../lib/sort";

export function useSort<T>(rows: T[], getValue: (row: T, field: string) => unknown, initialField: string | null = null) {
  const [field, setField] = useState<string | null>(initialField);
  const [direction, setDirection] = useState<SortDirection>("asc");

  function toggle(nextField: string) {
    if (field === nextField) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setField(nextField);
      setDirection("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!field) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = compareValues(getValue(a, field), getValue(b, field));
      return direction === "asc" ? cmp : -cmp;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, field, direction]);

  return { sorted, field, direction, toggle };
}
