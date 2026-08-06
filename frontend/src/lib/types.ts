export type UserRole = "admin" | "advisor";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  must_change_password: boolean;
  created_at: string;
}

export type CreatorStage =
  | "new_lead"
  | "outreach_sent"
  | "replied"
  | "negotiating"
  | "commercial_locked"
  | "product_sent"
  | "content_review"
  | "live"
  | "payment_pending"
  | "paid";

export type CreatorStatus = "priority" | "active" | "review_due" | "overdue" | "ndr" | "partnership" | "none";

export type CollabStage =
  | "new_lead"
  | "replied"
  | "negotiating"
  | "commercial_locked"
  | "product_sent"
  | "product_delivered"
  | "first_draft"
  | "approved"
  | "live"
  | "dead_leads";

export interface Product {
  id: number;
  name: string;
  owner_id: number;
  target_videos: number;
  created_at: string;
}

export interface ProductPerformance extends Product {
  owner_name: string;
  videos_live: number;
}

export interface CollabProduct {
  product_id: number;
  product_name: string;
  is_primary: boolean;
  is_live_attributed: boolean;
  credit: number | null;
}

export type PaymentStatus = "pending" | "partial_payment" | "payment_done";

export type ApprovalPriority = "high" | "normal";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: number;
  request_code: string;
  collaboration_id: number;
  creator_name: string;
  creator_handle: string;
  product_name: string;
  collab_stage_label: string;
  requested_by: number;
  requested_by_name: string;
  priority: ApprovalPriority;
  note: string;
  status: ApprovalStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface Collaboration {
  id: number;
  collab_code: string;
  creator_id: number;
  creator_name: string;
  creator_handle: string;
  products: CollabProduct[];
  owner_id: number;
  owner_name: string;
  stage: CollabStage;
  priority: CreatorStatus;
  payment_status: PaymentStatus;
  commercial_amount: number | null;
  note: string | null;
  creator_reply: string | null;
  commercial_quoted: number | null;
  counter_quote_agent: number | null;
  counter_quote_creator: number | null;
  tracking_link: string | null;
  order_id: string | null;
  is_overdue: boolean;
  creator_total_collabs: number;
  creator_videos_live: number;
  created_at: string;
  last_activity_at: string;
}

export interface OwnershipMatch {
  id: number;
  name: string;
  instagram_handle: string;
  owner_id: number;
  current_stage: CreatorStage;
}

export interface CollabBoardStats {
  unique_creators: number;
  active_collaborations: number;
  videos_live: number;
  dead_leads: number;
}

export interface Creator {
  id: number;
  name: string;
  instagram_handle: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  instagram_link: string | null;
  category: string;
  followers_count: number;
  owner_id: number;
  current_stage: CreatorStage;
  status: CreatorStatus;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  last_activity_at: string;
}

export interface CreatorTableRow {
  id: number;
  name: string;
  instagram_handle: string;
  phone: string | null;
  category: string;
  followers_count: number;
  owner_id: number;
  status: CreatorStatus;
  is_archived: boolean;
  created_at: string;
  videos_delivered: number;
  last_cost: number | null;
  last_video_live_at: string | null;
  last_video_product_name: string | null;
  comments_count: number | null;
  current_collab_stage_label: string | null;
}

export interface CreatorTableResponse {
  items: CreatorTableRow[];
  total: number;
}

export interface BulkUploadResult {
  created: number;
  skipped: number;
  errors: string[];
}

export interface NextAction {
  id: number;
  type: string;
  due_at: string;
  priority: string;
}

export interface StageTimelineEntry {
  stage: CreatorStage;
  label: string;
  status: "done" | "current" | "upcoming";
  event_date: string | null;
  note: string | null;
}

export interface CreatorDetail {
  creator: Creator;
  owner_name: string;
  next_action: NextAction | null;
  stage_timeline: StageTimelineEntry[];
}

export interface LifecycleTrackStep {
  label: string;
  status: "complete" | "current" | "upcoming";
}

export interface LifecycleTimelineEntry {
  icon: "stage" | "video" | "commercial" | "ownership" | "added";
  title: string;
  timestamp_label: string;
  description: string;
}

export interface LifecycleSummary {
  added_at: string;
  current_stage_label: string;
  videos_delivered: number;
  last_video_live_at: string | null;
  last_commercial_locked: number | null;
}

export interface VideoHistoryRow {
  product_name: string;
  live_date: string;
  cost: number | null;
  views: number | null;
  comments: number | null;
  status: "Live" | "Archived";
}

export interface CommercialHistoryRow {
  collab_code: string;
  product_name: string;
  creator_quote: number | null;
  agent_counter: number | null;
  creator_counter: number | null;
  locked: number | null;
  user_name: string;
  date: string;
}

export interface CommercialHistorySummary {
  last_locked_amount: number | null;
  last_locked_product_name: string | null;
  average_locked: number | null;
  retained_count: number;
  rows: CommercialHistoryRow[];
}

export interface OwnershipHistoryEntry {
  user_name: string;
  initials: string;
  status: "current" | "previous";
  note: string;
  since_label: string;
}

export interface CreatorLifecycle {
  creator_name: string;
  creator_handle: string;
  followers_count: number;
  owner_name: string;
  collab_code: string | null;
  summary: LifecycleSummary;
  track: LifecycleTrackStep[];
  timeline: LifecycleTimelineEntry[];
  video_history: VideoHistoryRow[];
  commercial_history: CommercialHistorySummary;
  ownership_history: OwnershipHistoryEntry[];
}

export type MessageChannel = "call" | "whatsapp" | "email" | "instagram_dm" | "note";

export interface Message {
  id: number;
  creator_id: number;
  author_id: number;
  author_name: string;
  channel: MessageChannel;
  body: string;
  created_at: string;
}

export interface CreatorFile {
  id: number;
  creator_id: number;
  uploaded_by: number;
  uploaded_by_name: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface KpiSummary {
  total_creators: number;
  new_this_month: number;
  active_reels: number;
  active_reels_growth_pct: number;
  active_reels_added_this_month: number;
  partnership_pending: number;
  ads_live: number;
  follow_ups_completed_today: number;
  follow_ups_total_today: number;
}

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversion_pct: number | null;
}

export interface TargetRow {
  user_id: number;
  name: string;
  weekly_completed: number;
  weekly_due: number;
  weekly_pct: number;
  monthly_completed: number;
  monthly_due: number;
  monthly_pct: number;
}

export interface ProductTarget {
  id: number;
  product_id: number;
  product_name: string;
  weekly_target: number;
  monthly_target: number;
  weekly_progress: number;
  monthly_progress: number;
}

export interface ActivityItem {
  headline: string;
  detail: string;
  created_at: string;
}

export interface AnnouncementOut {
  id: number;
  title: string;
  body: string;
  audience: "everyone" | "team" | "selected";
  audience_user_ids: number[] | null;
  expires_at: string | null;
  pinned: boolean;
  posted_by_name: string;
  created_at: string;
}

export interface DashboardResponse {
  kpis: KpiSummary;
  funnel: FunnelStage[];
  funnel_moved_this_week: number;
  targets: TargetRow[];
  product_performance: ProductPerformance[];
  approval_requests: ApprovalRequest[];
  activity: ActivityItem[];
  announcement: AnnouncementOut | null;
}
