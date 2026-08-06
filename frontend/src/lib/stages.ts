import type { CreatorStage } from "./types";

export const STAGE_ORDER: { key: CreatorStage; label: string; dotClassName: string }[] = [
  { key: "new_lead", label: "New leads", dotClassName: "bg-gray-400" },
  { key: "outreach_sent", label: "Outreach sent", dotClassName: "bg-sky-500" },
  { key: "replied", label: "Replied", dotClassName: "bg-violet-500" },
  { key: "negotiating", label: "Negotiation", dotClassName: "bg-amber-500" },
  { key: "commercial_locked", label: "Commercial locked", dotClassName: "bg-emerald-500" },
  { key: "product_sent", label: "Product sent", dotClassName: "bg-cyan-500" },
  { key: "content_review", label: "Content workflow", dotClassName: "bg-pink-500" },
  { key: "live", label: "Approved / Live", dotClassName: "bg-green-500" },
  { key: "payment_pending", label: "Payment", dotClassName: "bg-orange-500" },
  { key: "paid", label: "Paid", dotClassName: "bg-teal-500" },
];
