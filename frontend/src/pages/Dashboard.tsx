import { Bell, Calendar, Megaphone, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AnnouncementBanner } from "../components/dashboard/AnnouncementBanner";
import { AnnouncementModal } from "../components/dashboard/AnnouncementModal";
import { ApprovalRequests } from "../components/dashboard/ApprovalRequests";
import { DateRangePicker, type RangePreset } from "../components/dashboard/DateRangePicker";
import { KpiCard } from "../components/dashboard/KpiCard";
import { PipelineFunnel } from "../components/dashboard/PipelineFunnel";
import { ProductPerformance } from "../components/dashboard/ProductPerformance";
import { Targets } from "../components/dashboard/Targets";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { longWeekdayDate, timeBasedGreeting } from "../lib/format";
import type { DashboardResponse } from "../lib/types";

function rangeToDates(preset: RangePreset, customFrom: string, customTo: string): { from?: string; to?: string } {
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

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const greeting = timeBasedGreeting();

  function loadDashboard() {
    const { from, to } = rangeToDates(rangePreset, customFrom, customTo);
    api
      .get<DashboardResponse>("/dashboard", { params: { date_from: from, date_to: to } })
      .then((res) => setData(res.data));
  }

  useEffect(loadDashboard, [rangePreset, customFrom, customTo]);

  if (!data) {
    return (
      <div>
        <Topbar title={`${greeting}, ${user?.name?.split(" ")[0] ?? ""}`} />
        <p className="text-sm text-gray-400">Loading dashboard...</p>
      </div>
    );
  }

  if (data.placeholder_notice) {
    return (
      <div>
        <Topbar eyebrow={longWeekdayDate()} title={`${greeting}, ${user?.name?.split(" ")[0] ?? ""}`} />
        {data.announcement && (
          <AnnouncementBanner announcement={data.announcement} isAdmin={false} onManage={() => {}} />
        )}
        <div className="mt-6 rounded-card border border-dashed border-[#e7e5e4] bg-white p-8 text-center text-sm text-gray-500">
          {data.placeholder_notice}
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  const {
    kpis,
    funnel,
    funnel_moved_this_week,
    targets,
    product_performance,
    approval_requests,
    announcement,
  } = data;

  async function approveRequest(id: number) {
    await api.post(`/approval-requests/${id}/approve`);
    loadDashboard();
  }

  async function rejectRequest(id: number) {
    await api.post(`/approval-requests/${id}/reject`);
    loadDashboard();
  }

  return (
    <div>
      <Topbar
        eyebrow={longWeekdayDate()}
        title={`${greeting}, ${user?.name?.split(" ")[0] ?? ""}`}
        subtitle="Here's what needs your team's attention today."
        actions={
          <DateRangePicker
            preset={rangePreset}
            customFrom={customFrom}
            customTo={customTo}
            onSelectPreset={setRangePreset}
            onApplyCustom={(from, to) => {
              setCustomFrom(from);
              setCustomTo(to);
              setRangePreset("custom");
            }}
          />
        }
      />

      {announcement ? (
        <AnnouncementBanner
          announcement={announcement}
          isAdmin={isAdmin}
          onManage={() => setShowAnnouncementModal(true)}
        />
      ) : (
        isAdmin && (
          <button
            onClick={() => setShowAnnouncementModal(true)}
            className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-brand-200 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50"
          >
            <Plus size={14} />
            Post an announcement
          </button>
        )
      )}

      {showAnnouncementModal && (
        <AnnouncementModal onClose={() => setShowAnnouncementModal(false)} onSaved={loadDashboard} />
      )}

      <div className="mb-3 grid grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          tone="indigo"
          label="Total creators"
          value={kpis.total_creators.toLocaleString()}
          meta={`+${kpis.new_this_month} this month`}
          subtext="Across the master database"
        />
        <KpiCard
          icon={Megaphone}
          tone="green"
          label="Active reels"
          value={kpis.active_reels.toLocaleString()}
          meta={`+${kpis.active_reels_growth_pct}%`}
          subtext={`${kpis.active_reels_added_this_month} reels added this month`}
        />
        <KpiCard
          icon={Calendar}
          tone="amber"
          label="Partnership pending"
          value={kpis.partnership_pending.toLocaleString()}
          meta="Phase 2"
          subtext="Connection will be added next phase"
        />
        <KpiCard
          icon={Bell}
          tone="coral"
          label="Ads live"
          value={kpis.ads_live.toLocaleString()}
          meta="Phase 2"
          subtext="Connection will be added next phase"
        />
      </div>

      <div className="mb-3 grid grid-cols-[1.8fr_1fr] gap-3">
        <PipelineFunnel funnel={funnel} movedThisWeek={funnel_moved_this_week} />
        <ApprovalRequests
          requests={approval_requests}
          isAdmin={isAdmin}
          onApprove={approveRequest}
          onReject={rejectRequest}
        />
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-3">
        <Targets rows={targets} />
        <ProductPerformance products={product_performance} />
      </div>
    </div>
  );
}
