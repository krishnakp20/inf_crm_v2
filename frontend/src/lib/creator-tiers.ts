import type { CreatorCategoryTier } from "./types";

export function findTier(tiers: CreatorCategoryTier[], followers: number): CreatorCategoryTier | null {
  return (
    tiers.find((t) => followers >= t.min_followers && (t.max_followers === null || followers <= t.max_followers)) ??
    null
  );
}

export function tierLabel(t: CreatorCategoryTier): string {
  const max = t.max_followers !== null ? t.max_followers.toLocaleString() : "+";
  return `${t.name} (${t.min_followers.toLocaleString()} – ${max})`;
}
