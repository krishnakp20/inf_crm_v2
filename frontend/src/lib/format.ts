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
