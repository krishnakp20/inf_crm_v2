export type UserRole = "admin" | "supervisor" | "advisor" | "marketer" | "editor";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  supervisor_id: number | null;
  must_change_password: boolean;
  is_active: boolean;
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
  credit_by_owner: Record<string, number>;
}

export interface CollabProduct {
  product_id: number;
  product_name: string;
  is_primary: boolean;
  is_live_attributed: boolean;
  credit: number | null;
}

export type PaymentStatus = "pending" | "partial_payment" | "payment_done";

export type DealType = "paid" | "barter";
export type ContentType = "integrated" | "dedicated";

export type ApprovalPriority = "high" | "normal";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalTarget = "admin" | "supervisor";

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
  target: ApprovalTarget;
  created_at: string;
  resolved_at: string | null;
}

export interface Notification {
  kind: "approval" | "partnership";
  id: number;
  creator_name: string;
  creator_handle: string;
  subtitle: string;
  priority: "high" | "normal";
  created_at: string;
  link: string;
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
  deal_type: DealType | null;
  content_type: ContentType | null;
  tracking_link: string | null;
  order_id: string | null;
  poc_code: string | null;
  video_link: string | null;
  is_overdue: boolean;
  creator_total_collabs: number;
  creator_videos_live: number;
  created_at: string;
  last_activity_at: string;
  ownership_revoked_at: string | null;
  approval_status: ApprovalStatus | null;
  approval_target: ApprovalTarget | null;
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
  alternate_phone: string | null;
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
  archived_at: string | null;
  archive_reason: string | null;
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

export interface BulkUploadRowResult {
  row: number;
  instagram_handle: string;
  name: string;
  status: "created" | "already_present" | "error";
  reason: string;
  existing_owner: string | null;
  existing_stage: string | null;
}

export interface BulkUploadResult {
  created: number;
  skipped: number;
  errors: string[];
  rows: BulkUploadRowResult[];
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

export interface ActivityLogEntry {
  event_type: "assigned" | "transferred" | "admin_assigned" | "revoked";
  title: string;
  description: string;
  actor_name: string | null;
  timestamp_label: string;
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
  activity_log: ActivityLogEntry[];
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
  placeholder_notice: string | null;
}

export type Platform = "instagram" | "youtube";

export type CampaignStatus = "draft" | "scheduled" | "live" | "paused" | "completed";

export interface CampaignProduct {
  product_id: number;
  product_name: string;
  target_videos: number;
  live_credit: number;
}

export interface CampaignParticipant {
  user_id: number;
  user_name: string;
  allocation: number;
  is_mandatory: boolean;
  live_count: number;
}

export interface Campaign {
  id: number;
  campaign_code: string;
  name: string;
  status: CampaignStatus;
  target_videos: number;
  creators_needed: number | null;
  deadline: string | null;
  demographic: string | null;
  language: string | null;
  platforms: Platform[];
  products: CampaignProduct[];
  participants: CampaignParticipant[];
  live_ads_count: number;
  committed: number;
  unassigned: number;
  progress_pct: number;
  created_by: number;
  created_at: string;
}

export interface CampaignListItem {
  id: number;
  campaign_code: string;
  name: string;
  status: CampaignStatus;
  deadline: string | null;
  platforms: Platform[];
  product_names: string[];
  participant_count: number;
  committed: number;
  unassigned: number;
  live_ads_count: number;
  target_videos: number;
  progress_pct: number;
  creators_needed: number | null;
  created_at: string;
}

export interface CampaignStats {
  total_campaigns: number;
  currently_live: number;
  live_ads: number;
  target_ads: number;
  target_completion_pct: number;
}

export interface CampaignAd {
  collab_id: number;
  collab_code: string;
  campaign_id: number;
  campaign_name: string;
  product_names: string[];
  platform: Platform | null;
  owner_id: number;
  owner_name: string;
  live_date: string | null;
  views_count: number | null;
  comments_count: number | null;
}

export type TicketStatus = "open" | "pending_at_user" | "pending_at_admin" | "closed_and_live";

export type PartnershipCollabStatus =
  | "open"
  | "partnership_sent"
  | "need_tag"
  | "ad_code_not_working"
  | "closed"
  | "closed_and_live";

export interface PartnershipOverviewRow {
  ticket_id: number;
  collaboration_id: number;
  collab_code: string;
  poc_code: string | null;
  video_name: string;
  creator_handle: string;
  product_names: string[];
  owner_id: number;
  owner_name: string;
  live_date: string | null;
  comments_count: number | null;
  views_count: number | null;
  content_bucket: string | null;
  language: string | null;
  creator_category: string;
  platform: Platform | null;
  ad_rights_creator_quote: number | null;
  ad_rights_agent_counter: number | null;
  ad_rights_admin_counter: number | null;
  ad_rights_amount: number | null;
  ad_code: string | null;
  ad_right_duration_days: number | null;
  ad_right_expires_at: string | null;
  cta_link: string | null;
  ticket_status: TicketStatus;
  collab_status: PartnershipCollabStatus;
  latest_remark: string | null;
  latest_remark_author: string | null;
  remark_count: number;
}

export interface PartnershipOpenRow extends PartnershipOverviewRow {
  aging_bucket: string | null;
  aging_days: number | null;
  response_due_at: string | null;
  requested: string[];
}

export interface PartnershipRemark {
  id: number;
  author_id: number;
  author_name: string;
  author_role: string;
  body: string;
  tag: string | null;
  created_at: string;
}

export interface PartnershipTicketDetail {
  id: number;
  collaboration_id: number;
  collab_code: string;
  video_name: string;
  creator_handle: string;
  product_names: string[];
  owner_id: number;
  owner_name: string;
  live_date: string | null;
  content_bucket: string | null;
  language: string | null;
  ticket_status: TicketStatus;
  collab_status: PartnershipCollabStatus;
  requested_ad_rights: boolean;
  requested_ad_code: boolean;
  requested_cta_link: boolean;
  ad_rights_creator_quote: number | null;
  ad_rights_agent_counter: number | null;
  ad_rights_admin_counter: number | null;
  ad_rights_amount: number | null;
  ad_code: string | null;
  ad_right_duration_days: number | null;
  ad_right_expires_at: string | null;
  cta_link: string | null;
  response_due_at: string | null;
  aging_bucket: string | null;
  aging_days: number | null;
  remarks: PartnershipRemark[];
}

export interface PartnershipEditorTicket {
  id: number;
  collaboration_id: number;
  collab_code: string;
  video_name: string;
  product_names: string[];
  owner_id: number;
  owner_name: string;
  live_date: string | null;
  ticket_status: TicketStatus;
  cta_link: string | null;
  remarks: PartnershipRemark[];
}

export interface PartnershipStats {
  video_register: number;
  open_tickets: number;
  awaiting_my_action: number;
  closed_and_live: number;
}

export interface AnalyticsBusinessImpact {
  revenue: number | null;
  roas: number | null;
  ads_live: number;
}

export interface AnalyticsPerformanceOverview {
  live_videos: number;
  total_views: number;
  cpv: number | null;
  hit_rate_pct: number;
  hits: number;
  total_live_videos_for_hit_rate: number;
  cost_per_comment: number | null;
  total_comments: number;
}

export interface AnalyticsProductPerformanceRow {
  product_id: number;
  product_name: string;
  videos: number;
  views: number;
  comments: number;
  cost_per_comment: number | null;
}

export interface AnalyticsCostEfficiency {
  avg_creator_cost: number | null;
  total_creator_cost: number;
  cost_per_hit: number | null;
}

export interface AnalyticsCommercialLocked {
  total_locked: number;
  achieved: number;
  committed: number;
}

export interface AnalyticsWhatIsWorkingRow {
  rank: number;
  dimension_value: string;
  videos: number;
  views: number;
  comments: number;
  hit_rate_pct: number;
}

export interface AnalyticsWhatIsWorking {
  content_bucket: AnalyticsWhatIsWorkingRow[];
  language: AnalyticsWhatIsWorkingRow[];
  creator_category: AnalyticsWhatIsWorkingRow[];
}

export interface AnalyticsPipelineVelocityRow {
  label: string;
  avg_days: number | null;
  delta_days: number | null;
  sample_size: number;
}

export interface AnalyticsTargetRow {
  user_id: number;
  user_name: string;
  credit: number;
  target: number;
  pct: number;
}

export interface AnalyticsResponse {
  scope_label: string;
  date_range_label: string;
  live_video_count: number;
  business_impact: AnalyticsBusinessImpact;
  performance_overview: AnalyticsPerformanceOverview;
  product_performance: AnalyticsProductPerformanceRow[];
  cost_efficiency: AnalyticsCostEfficiency | null;
  commercial_locked: AnalyticsCommercialLocked | null;
  what_is_working: AnalyticsWhatIsWorking;
  pipeline_velocity: AnalyticsPipelineVelocityRow[];
  target_vs_achieved: AnalyticsTargetRow[];
  show_cpv: boolean;
  show_cost_efficiency: boolean;
  show_revenue: boolean;
}

export type MetricImportStatus = "completed" | "failed";

export interface MetricUploadResult {
  total_rows: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface MetricImport {
  id: number;
  filename: string;
  total_rows: number;
  updated_rows: number;
  skipped_rows: number;
  status: MetricImportStatus;
  uploaded_by_name: string;
  created_at: string;
}
