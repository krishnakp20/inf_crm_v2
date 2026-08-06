import type { CollabStage } from "./types";

export const COLLAB_STAGE_ORDER: { key: CollabStage; label: string; dotClassName: string }[] = [
  { key: "new_lead", label: "New leads", dotClassName: "bg-gray-400" },
  { key: "replied", label: "Replied", dotClassName: "bg-violet-500" },
  { key: "negotiating", label: "Negotiation", dotClassName: "bg-amber-500" },
  { key: "commercial_locked", label: "Commercial locked", dotClassName: "bg-emerald-500" },
  { key: "product_sent", label: "Product sent", dotClassName: "bg-cyan-500" },
  { key: "product_delivered", label: "Product Delivered", dotClassName: "bg-teal-500" },
  { key: "first_draft", label: "First Draft", dotClassName: "bg-pink-500" },
  { key: "approved", label: "Approved", dotClassName: "bg-indigo-500" },
  { key: "live", label: "Live", dotClassName: "bg-green-500" },
  { key: "dead_leads", label: "Dead Leads", dotClassName: "bg-red-500" },
];

/** Stages a new collaboration can actually be created into (mirrors the
 * backend's STARTABLE_STAGES) -- Dead Leads is reached by moving a card
 * there, never chosen as a starting point. */
export const STARTABLE_COLLAB_STAGES = COLLAB_STAGE_ORDER.slice(0, -1);
