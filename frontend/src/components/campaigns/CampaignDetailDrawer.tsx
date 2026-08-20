import { Download, Plus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { CAMPAIGN_STATUS_BADGE, CAMPAIGN_STATUS_LABELS, PLATFORM_LABELS } from "../../lib/campaign-stages";
import { downloadCsv } from "../../lib/csv";
import { initials } from "../../lib/format";
import type { Campaign } from "../../lib/types";
import { AddVideoModal } from "./AddVideoModal";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function CampaignDetailDrawer({
  campaignId,
  onClose,
  onChanged,
  onViewAds,
}: {
  campaignId: number;
  onClose: () => void;
  onChanged: () => void;
  onViewAds: (campaignId: number) => void;
}) {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [joinAllocation, setJoinAllocation] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  function load() {
    api.get<Campaign>(`/campaigns/${campaignId}`).then((res) => setCampaign(res.data));
  }

  useEffect(load, [campaignId]);

  function refresh() {
    load();
    onChanged();
  }

  async function handleJoin() {
    setJoinError(null);
    setJoining(true);
    try {
      await api.post(`/campaigns/${campaignId}/join`, { allocation: Number(joinAllocation) || 0 });
      setJoinAllocation("");
      refresh();
    } catch (err: any) {
      setJoinError(err.response?.data?.detail ?? "Could not join this campaign.");
    } finally {
      setJoining(false);
    }
  }

  function exportBrief() {
    if (!campaign) return;
    downloadCsv(
      `${campaign.campaign_code}-brief.csv`,
      ["Participant", "Allocation", "Live", "Mandatory"],
      campaign.participants.map((p) => [p.user_name, String(p.allocation), String(p.live_count), p.is_mandatory ? "Yes" : "No"])
    );
  }

  if (!campaign) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30">
        <div className="fixed right-0 top-0 h-full w-[50vw] min-w-[520px] bg-white p-6 shadow-lg">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  const isAdvisor = user?.role === "advisor";
  const alreadyJoined = !!user && campaign.participants.some((p) => p.user_id === user.id);
  const canJoin = isAdvisor && !alreadyJoined && (campaign.status === "scheduled" || campaign.status === "live");
  const badge = CAMPAIGN_STATUS_BADGE[campaign.status];

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <aside
        className="fixed right-0 top-0 flex h-full w-[50vw] min-w-[520px] flex-col bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div>
            <div className="text-xs text-gray-400">{campaign.campaign_code}</div>
            <div className="text-base font-semibold text-ink">{campaign.name}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge}`}>
                {CAMPAIGN_STATUS_LABELS[campaign.status]}
              </span>
              <span className="text-xs text-gray-400">
                {campaign.platforms.map((p) => PLATFORM_LABELS[p]).join(" + ") || "No platform"}
                {campaign.language ? ` · ${campaign.language}` : ""}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Campaign completion</span>
              <span className="text-lg font-bold text-brand-600">{campaign.progress_pct}%</span>
            </div>
            <p className="text-xs text-gray-500">
              {campaign.live_ads_count} Live of {campaign.target_videos} target ·{" "}
              {Math.max(campaign.target_videos - campaign.live_ads_count, 0)} remaining
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-brand-600"
                style={{ width: `${Math.min(campaign.progress_pct, 100)}%` }}
              />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-card border border-[#e7e5e4] p-3">
              <div className="text-[10px] text-muted">Deadline</div>
              <div className="mt-1 text-sm font-bold text-ink">{formatDate(campaign.deadline)}</div>
            </div>
            <div className="rounded-card border border-[#e7e5e4] p-3">
              <div className="text-[10px] text-muted">Creators needed</div>
              <div className="mt-1 text-sm font-bold text-ink">{campaign.creators_needed ?? "—"}</div>
            </div>
            <div className="rounded-card border border-[#e7e5e4] p-3">
              <div className="text-[10px] text-muted">Audience</div>
              <div className="mt-1 text-sm font-bold text-ink">{campaign.demographic ?? "—"}</div>
            </div>
            <div className="rounded-card border border-[#e7e5e4] p-3">
              <div className="text-[10px] text-muted">Language</div>
              <div className="mt-1 text-sm font-bold text-ink">{campaign.language ?? "—"}</div>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
              <div className="text-[10px] text-muted">Committed by participants</div>
              <div className="mt-1 text-lg font-bold text-ink">{campaign.committed}</div>
            </div>
            <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
              <div className="text-[10px] text-muted">Open for users to claim</div>
              <div className="mt-1 text-lg font-bold text-ink">{campaign.unassigned}</div>
            </div>
            <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
              <div className="text-[10px] text-muted">Total campaign target</div>
              <div className="mt-1 text-lg font-bold text-ink">{campaign.target_videos}</div>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-semibold text-ink">Campaign participants</h3>
            <p className="mt-0.5 text-xs text-muted">Mandatory applies to a user commitment, never to a product.</p>
            <div className="mt-3 flex flex-col gap-2">
              {campaign.participants.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between rounded-card border border-[#e7e5e4] p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[9px] font-extrabold text-brand-600">
                      {initials(p.user_name)}
                    </div>
                    <span className="text-sm font-semibold text-ink">{p.user_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {p.live_count} / {p.allocation} Live
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        p.is_mandatory ? "bg-[#fff0ed] text-[#ca4d43]" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.is_mandatory ? "Mandatory" : "Optional"}
                    </span>
                  </div>
                </div>
              ))}
              {campaign.participants.length === 0 && <p className="text-xs text-gray-400">No participants yet.</p>}
            </div>

            {canJoin && (
              <div className="mt-3 flex items-center gap-2 rounded-card border border-dashed border-brand-200 p-3">
                <UserPlus size={16} className="shrink-0 text-brand-600" />
                <input
                  type="number"
                  min={0}
                  value={joinAllocation}
                  onChange={(e) => setJoinAllocation(e.target.value)}
                  placeholder="Allocation"
                  className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <button
                  onClick={handleJoin}
                  disabled={joining || !joinAllocation}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {joining ? "Joining..." : "Join this campaign"}
                </button>
              </div>
            )}
            {joinError && <p className="mt-2 text-xs text-red-600">{joinError}</p>}
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-semibold text-ink">Product contribution</h3>
            <p className="mt-0.5 text-xs text-muted">Product goals guide the mix; they do not carry mandatory status.</p>
            <div className="mt-3 flex flex-col gap-2">
              {campaign.products.map((p) => (
                <div key={p.product_id} className="rounded-card border border-[#e7e5e4] p-2.5">
                  <div className="text-sm font-semibold text-ink">{p.product_name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">Planning goal</div>
                  <div className="text-xs text-gray-500">
                    {p.live_credit} / {p.target_videos} Live credit
                  </div>
                </div>
              ))}
              {campaign.products.length === 0 && <p className="text-xs text-gray-400">No product goals set.</p>}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-[#e7e5e4] p-4">
          <button
            onClick={exportBrief}
            className="flex items-center gap-1.5 rounded-lg border border-[#e7e5e4] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface"
          >
            <Download size={12} /> Export brief
          </button>
          <div className="flex items-center gap-2">
            {(isAdmin || (isAdvisor && alreadyJoined)) && (
              <button
                onClick={() => setShowAddVideo(true)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
              >
                <Plus size={12} /> Add video
              </button>
            )}
            <button
              onClick={() => onViewAds(campaign.id)}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              View campaign ads →
            </button>
          </div>
        </footer>
      </aside>

      {showAddVideo && (
        <AddVideoModal campaignId={campaign.id} onClose={() => setShowAddVideo(false)} onLinked={refresh} />
      )}
    </div>
  );
}
