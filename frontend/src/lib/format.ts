import type { UserRole } from "./types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  advisor: "Influencer Agent",
  marketer: "Marketer",
  editor: "Video Editor",
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function timeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function longWeekdayDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
}

export function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  const letters = parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]) : [...parts[0].slice(0, 2)];
  return letters.join("").toUpperCase();
}

function trimTrailingZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

// Indian numbering (Lakh/Crore) rather than Western K/M, matching the
// client's reference design (all follower counts shown as "1.8L" etc.).
export function compactNumber(n: number): string {
  if (n >= 10_000_000) return `${trimTrailingZero((n / 10_000_000).toFixed(1))}Cr`;
  if (n >= 100_000) return `${trimTrailingZero((n / 100_000).toFixed(1))}L`;
  if (n >= 1_000) return `${trimTrailingZero((n / 1_000).toFixed(1))}K`;
  return String(n);
}

export function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, "").trim()}`;
}

/** Some older creator records have a full profile URL (with query params)
 * stored as their "handle" instead of a clean username -- shows a long,
 * ugly string that breaks row layout wherever it's displayed. Extracts
 * just the username portion for DISPLAY only; the stored value is left
 * untouched since other things (Metric Upload matching, etc.) may depend
 * on it exactly as entered. Same extraction OwnershipCheck already does
 * for pasted profile links. */
export function displayHandle(handle: string): string {
  let value = handle.trim();
  if (/instagram\.com/i.test(value)) {
    value = value.split("?")[0].replace(/\/+$/, "").split("/").pop() ?? value;
  }
  return value.replace(/^@/, "");
}

// A real username only ever has letters, numbers, periods and underscores
// (Instagram's own rule) -- anything else (a "/", ":", "?", "=", a space)
// means a full profile link got pasted in by mistake, exactly the
// malformed-handle records displayHandle() above exists to paper over.
// Blocking it at entry is better than cleaning it up after the fact.
const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;

/** null when the entered username is clean; an error message to show
 * otherwise. Takes the raw field value (leading "@" is fine). */
export function usernameLinkError(rawHandle: string): string | null {
  const value = rawHandle.trim().replace(/^@/, "");
  if (!value) return null;
  if (!USERNAME_PATTERN.test(value)) {
    return "Enter just the username (e.g. creator_name), not a profile link.";
  }
  return null;
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const match = phone.match(/^(\+\d+)\s*(\d+)$/);
  if (!match) return phone;
  const [, countryCode, digits] = match;
  if (digits.length <= 6) return phone;
  const visibleStart = digits.slice(0, 2);
  const visibleEnd = digits.slice(-4);
  return `${countryCode} ${visibleStart}•••${visibleEnd}`;
}
