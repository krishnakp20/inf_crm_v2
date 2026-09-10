import type { RangePreset } from "../components/dashboard/DateRangePicker";

export function rangeToDates(
  preset: RangePreset,
  customFrom: string,
  customTo: string
): { from?: string; to?: string } {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (preset === "7d") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (preset === "30d") {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (customFrom && customTo) {
    return { from: new Date(customFrom).toISOString(), to: new Date(`${customTo}T23:59:59`).toISOString() };
  }
  return {};
}

/** Plain YYYY-MM-DD in the browser's local timezone, for endpoints that take
 * a `date` rather than a full datetime (re-parses so the calendar date is
 * read back correctly regardless of the ISO string's UTC offset). */
export function toLocalDateString(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
