import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdsTable } from "../components/campaigns/AdsTable";
import { CampaignDetailDrawer } from "../components/campaigns/CampaignDetailDrawer";
import { CampaignFilters } from "../components/campaigns/CampaignFilters";
import { CampaignStatsRow } from "../components/campaigns/CampaignStatsRow";
import { CampaignTable } from "../components/campaigns/CampaignTable";
import { NewCampaignWizard } from "../components/campaigns/NewCampaignWizard";
import { Topbar } from "../components/layout/Topbar";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { SearchableSelect } from "../components/shared/SearchableSelect";
import type { CampaignAd, CampaignListItem, CampaignStats, CampaignStatus, Platform, Product, User } from "../lib/types";

type Tab = "campaigns" | "ads";

export default function Campaigns() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [ads, setAds] = useState<CampaignAd[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [detailCampaignId, setDetailCampaignId] = useState<number | null>(null);
  const [adsCampaignFilter, setAdsCampaignFilter] = useState<number | "">("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "">("");
  const [productId, setProductId] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    api.get<Product[]>("/products").then((res) => setProducts(res.data));
    api.get<User[]>("/users").then((res) => setUsers(res.data));
  }, []);

  function loadCampaigns() {
    api
      .get<CampaignListItem[]>("/campaigns", {
        params: {
          search: search || undefined,
          status: status || undefined,
          product_id: productId || undefined,
          platform: platform || undefined,
          user_id: userId || undefined,
        },
      })
      .then((res) => setCampaigns(res.data));
  }

  function loadAds() {
    api
      .get<CampaignAd[]>("/campaigns/ads", {
        params: {
          campaign_id: adsCampaignFilter || undefined,
          product_id: productId || undefined,
          platform: platform || undefined,
          user_id: userId || undefined,
        },
      })
      .then((res) => setAds(res.data));
  }

  useEffect(loadCampaigns, [search, status, productId, platform, userId]);
  useEffect(loadAds, [adsCampaignFilter, productId, platform, userId]);

  function refresh() {
    loadCampaigns();
    loadAds();
  }

  // KPI cards react to both the active tab and its current filters, matching
  // the reference site: on the Campaigns tab they summarize the filtered
  // campaign rows themselves; on the Ads tab "Live ads" becomes the filtered
  // Live-ads row count, and "Total campaigns"/"Target ads" narrow to just the
  // single campaign selected in the Ads filter (or stay global otherwise).
  const stats: CampaignStats = useMemo(() => {
    const scope = tab === "ads" && adsCampaignFilter ? campaigns.filter((c) => c.id === adsCampaignFilter) : campaigns;
    const liveAds = tab === "ads" ? ads.length : scope.reduce((sum, c) => sum + c.live_ads_count, 0);
    const targetAds = scope.reduce((sum, c) => sum + c.target_videos, 0);
    return {
      total_campaigns: scope.length,
      currently_live: scope.filter((c) => c.status === "live").length,
      live_ads: liveAds,
      target_ads: targetAds,
      target_completion_pct: targetAds ? Math.round((liveAds / targetAds) * 100) : 0,
    };
  }, [tab, campaigns, ads, adsCampaignFilter]);

  if (user && user.role === "editor") {
    return <Navigate to="/" replace />;
  }

  const advisors = users.filter((u) => u.role === "advisor" && u.is_active);
  const canCreate = user?.role === "admin";

  return (
    <div>
      <Topbar
        eyebrow="CAMPAIGN WORKSPACE"
        title="Campaigns"
        subtitle="Set team commitments, keep open capacity visible and track every participating user."
        actions={
          canCreate ? (
            <button
              onClick={() => setShowNewCampaign(true)}
              className="flex items-center gap-1.5 rounded-[10px] bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              New campaign
            </button>
          ) : undefined
        }
      />

      <CampaignStatsRow stats={stats} />

      <div className="mb-4 flex items-center justify-center gap-3 rounded-card border border-[#e7e5e4] bg-white p-4">
        {(
          [
            { key: "campaigns" as Tab, step: 1, label: "Campaigns", count: campaigns.length },
            { key: "ads" as Tab, step: 2, label: "Ads", count: ads.length },
          ]
        ).map((s, i, arr) => (
          <div key={s.key} className="flex items-center gap-3">
            <button onClick={() => setTab(s.key)} className="flex items-center gap-2">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${
                  tab === s.key ? "border-brand-600 bg-brand-600 text-white" : "border-[#e7e5e4] text-gray-400"
                }`}
              >
                {s.step}
              </span>
              <span className={`text-sm font-semibold ${tab === s.key ? "text-brand-600" : "text-ink"}`}>
                {s.label}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  tab === s.key ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-500"
                }`}
              >
                {s.count}
              </span>
            </button>
            {i < arr.length - 1 && <span className="h-0.5 w-20 bg-[#e7e5e4]" />}
          </div>
        ))}
      </div>

      {tab === "campaigns" ? (
        <>
          <CampaignFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            productId={productId}
            onProductChange={setProductId}
            platform={platform}
            onPlatformChange={setPlatform}
            userId={userId}
            onUserChange={setUserId}
            products={products}
            users={advisors}
          />
          <CampaignTable campaigns={campaigns} onOpen={setDetailCampaignId} />
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <SearchableSelect
              ariaLabel="Filter by campaign"
              value={String(adsCampaignFilter)}
              onChange={(v) => setAdsCampaignFilter(v ? Number(v) : "")}
              className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
              options={[{ value: "", label: "All campaigns" }, ...campaigns.map((c) => ({ value: String(c.id), label: c.name }))]}
            />
            <SearchableSelect
              ariaLabel="Filter by product"
              value={productId}
              onChange={setProductId}
              className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
              options={[{ value: "", label: "All products" }, ...products.map((p) => ({ value: String(p.id), label: p.name }))]}
            />
            <SearchableSelect
              ariaLabel="Filter by platform"
              value={platform}
              onChange={(v) => setPlatform(v as Platform | "")}
              className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
              options={[
                { value: "", label: "All platforms" },
                { value: "instagram", label: "Instagram" },
                { value: "youtube", label: "YouTube" },
                { value: "facebook", label: "Facebook" },
              ]}
            />
            <SearchableSelect
              ariaLabel="Filter by user"
              value={userId}
              onChange={setUserId}
              className="h-9 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-xs font-semibold text-ink"
              options={[{ value: "", label: "All users" }, ...advisors.map((u) => ({ value: String(u.id), label: u.name }))]}
            />
          </div>
          <AdsTable ads={ads} />
        </>
      )}

      {showNewCampaign && (
        <NewCampaignWizard
          products={products}
          advisors={advisors}
          onClose={() => setShowNewCampaign(false)}
          onCreated={refresh}
        />
      )}

      {detailCampaignId && (
        <CampaignDetailDrawer
          campaignId={detailCampaignId}
          onClose={() => setDetailCampaignId(null)}
          onChanged={refresh}
          onViewAds={(campaignId) => {
            setDetailCampaignId(null);
            setAdsCampaignFilter(campaignId);
            setTab("ads");
          }}
        />
      )}
    </div>
  );
}
