import type { PartnershipCollabStatus, TicketStatus } from "./types";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  pending_at_user: "Pending at User",
  pending_at_admin: "Pending at Admin",
  closed_and_live: "Closed & Live",
};

export const TICKET_STATUS_BADGE: Record<TicketStatus, string> = {
  open: "bg-gray-100 text-gray-600",
  pending_at_user: "bg-amber-50 text-amber-600",
  pending_at_admin: "bg-brand-100 text-brand-600",
  closed_and_live: "bg-emerald-50 text-emerald-600",
};

export const COLLAB_STATUS_LABELS: Record<PartnershipCollabStatus, string> = {
  open: "Open",
  partnership_sent: "Partnership Sent",
  need_tag: "Need Tag",
  ad_code_not_working: "Ad Code Not Working",
  closed: "Closed",
  closed_and_live: "Closed & Live",
};

export const COLLAB_STATUS_OPTIONS: { key: PartnershipCollabStatus; label: string }[] = (
  Object.keys(COLLAB_STATUS_LABELS) as PartnershipCollabStatus[]
).map((key) => ({ key, label: COLLAB_STATUS_LABELS[key] }));

export const AGING_BADGE: Record<string, string> = {
  Normal: "bg-emerald-50 text-emerald-600",
  "Follow up": "bg-amber-50 text-amber-600",
  Escalate: "bg-[#fff0ed] text-[#cf4e43]",
};
