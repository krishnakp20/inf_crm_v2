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
import { rangeToDates } from "../lib/dateRange";
import { longWeekdayDate, timeBasedGreeting } from "../lib/format";
import type { DashboardResponse } from "../lib/types";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const greeting = timeBasedGreeting();

  function loadDashboard() {
    const { from, to } = rangeToDates(rangePreset, customFrom, customTo);
    api
      .get<DashboardResponse>("/dashboard", { params: { date_from: from, date_to: to } })
      .then((res) => setData(res.data));
  }

  useEffect(loadDashboard, [rangePreset, customFrom, customTo]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

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
  const canApprove = isAdmin || user?.role === "supervisor";

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
    setSuccessMessage("Request approved.");
    loadDashboard();
  }

  async function rejectRequest(id: number, note: string) {
    await api.post(`/approval-requests/${id}/reject`, { note });
    setSuccessMessage("Request rejected.");
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

      {successMessage && (
        <div className="mb-4 flex items-center justify-between rounded-card border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-xs text-emerald-700 hover:opacity-70">
            Dismiss
          </button>
        </div>
      )}

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
          subtext="Open tickets in Partnership Hub"
        />
        <KpiCard
          icon={Bell}
          tone="coral"
          label="Ads live"
          value={kpis.ads_live.toLocaleString()}
          subtext="Closed & Live in Partnership Hub"
        />
      </div>

      <div className="mb-3 grid grid-cols-[1.8fr_1fr] gap-3">
        <PipelineFunnel funnel={funnel} movedThisWeek={funnel_moved_this_week} />
        <ApprovalRequests
          requests={approval_requests}
          canApprove={canApprove}
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
