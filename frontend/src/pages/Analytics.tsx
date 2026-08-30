import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { AnalyticsSummaryStrip } from "../components/analytics/AnalyticsSummaryStrip";
import { AnalyticsTabs, type AnalyticsTab } from "../components/analytics/AnalyticsTabs";
import { BusinessImpactRow } from "../components/analytics/BusinessImpactRow";
import { CommercialLockedPanel } from "../components/analytics/CommercialLockedPanel";
import { CostEfficiencyPanel } from "../components/analytics/CostEfficiencyPanel";
import { PerformanceOverviewRow } from "../components/analytics/PerformanceOverviewRow";
import { PipelineVelocityPanel } from "../components/analytics/PipelineVelocityPanel";
import { ProductPerformanceTable } from "../components/analytics/ProductPerformanceTable";
import { TargetVsAchievedPanel } from "../components/analytics/TargetVsAchievedPanel";
import { WhatIsWorkingPanel } from "../components/analytics/WhatIsWorkingPanel";
import { DateRangePicker, type RangePreset } from "../components/dashboard/DateRangePicker";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { downloadCsv } from "../lib/csv";
import type { AnalyticsResponse, User } from "../lib/types";

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

export default function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<AnalyticsTab>(user?.role === "supervisor" ? "team" : "overall");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "supervisor") {
      api.get<User[]>("/users").then((res) => setUsers(res.data));
    }
  }, [user?.role]);

  function loadAnalytics() {
    const { from, to } = rangeToDates(rangePreset, customFrom, customTo);
    api
      .get<AnalyticsResponse>("/analytics", {
        params: {
          scope: tab,
          user_id: tab === "user" ? selectedUserId ?? undefined : undefined,
          date_from: from,
          date_to: to,
        },
      })
      .then((res) => {
        setData(res.data);
        setError(false);
      })
      .catch(() => setError(true));
  }

  useEffect(loadAnalytics, [tab, selectedUserId, rangePreset, customFrom, customTo]);

  if (error) {
    return (
      <div>
        <Topbar eyebrow="CROSS-CRM PERFORMANCE" title="Analytics" />
        <p className="text-sm text-gray-400">Not available for this role.</p>
      </div>
    );
  }

  const advisorOptions = users.filter(
    (u) => u.role === "advisor" && (user?.role === "admin" || u.supervisor_id === user?.id)
  );

  function exportReport() {
    if (!data) return;
    downloadCsv(
      `analytics-${data.scope_label.replace(/\s+/g, "-").toLowerCase()}.csv`,
      ["Product", "Videos", "Views", "Comments", "Cost/Comment"],
      data.product_performance.map((p) => [
        p.product_name,
        String(p.videos),
        String(p.views),
        String(p.comments),
        p.cost_per_comment != null ? String(p.cost_per_comment) : "",
      ])
    );
  }

  return (
    <div>
      <Topbar
        eyebrow="CROSS-CRM PERFORMANCE"
        title="Analytics"
        subtitle="See output, efficiency and pipeline health without leaving the CRM."
        actions={
          <div className="flex items-center gap-2.5">
            {user?.role === "admin" && (
              <button
                onClick={exportReport}
                className="flex items-center gap-1.5 rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-2.5 text-xs font-bold text-ink hover:bg-surface"
              >
                <Download size={14} />
                Export report
              </button>
            )}
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
          </div>
        }
      />

      {user && (
        <AnalyticsTabs
          role={user.role}
          tab={tab}
          onTabChange={(t) => {
            setTab(t);
            if (t !== "user") setSelectedUserId(null);
          }}
        />
      )}

      {tab === "user" && (user?.role === "admin" || user?.role === "supervisor") && (
        <div className="mb-4">
          <select
            value={selectedUserId ?? ""}
            onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
          >
            <option value="">Select a user...</option>
            {advisorOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!data ? (
        <p className="text-sm text-gray-400">Loading analytics...</p>
      ) : (
        <>
          <AnalyticsSummaryStrip
            scopeLabel={data.scope_label}
            dateRangeLabel={data.date_range_label}
            liveVideoCount={data.live_video_count}
          />
          <BusinessImpactRow data={data.business_impact} showRevenue={data.show_revenue} />
          <PerformanceOverviewRow data={data.performance_overview} showCpv={data.show_cpv} />
          <ProductPerformanceTable rows={data.product_performance} showCostPerComment={data.show_cost_efficiency} />
          {data.cost_efficiency && <CostEfficiencyPanel data={data.cost_efficiency} />}
          {data.commercial_locked && <CommercialLockedPanel data={data.commercial_locked} />}
          <WhatIsWorkingPanel data={data.what_is_working} />
          <PipelineVelocityPanel rows={data.pipeline_velocity} />
          <TargetVsAchievedPanel rows={data.target_vs_achieved} />
        </>
      )}
    </div>
  );
}
