import type { CampaignStatus, Platform } from "./types";

export const CAMPAIGN_STATUS_ORDER: { key: CampaignStatus; label: string; badgeClassName: string }[] = [
  { key: "draft", label: "Draft", badgeClassName: "bg-gray-100 text-gray-600" },
  { key: "scheduled", label: "Scheduled", badgeClassName: "bg-amber-50 text-amber-600" },
  { key: "live", label: "Live", badgeClassName: "bg-emerald-50 text-emerald-600" },
  { key: "paused", label: "Paused", badgeClassName: "bg-orange-50 text-orange-600" },
  { key: "completed", label: "Completed", badgeClassName: "bg-brand-100 text-brand-600" },
];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = Object.fromEntries(
  CAMPAIGN_STATUS_ORDER.map((s) => [s.key, s.label])
) as Record<CampaignStatus, string>;

export const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, string> = Object.fromEntries(
  CAMPAIGN_STATUS_ORDER.map((s) => [s.key, s.badgeClassName])
) as Record<CampaignStatus, string>;

export const PLATFORM_OPTIONS: { key: Platform; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
];

export const PLATFORM_LABELS: Record<Platform, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((p) => [p.key, p.label])
) as Record<Platform, string>;
