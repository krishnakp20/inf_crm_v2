import { Plus, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../../lib/api";
import { CAMPAIGN_STATUS_ORDER, PLATFORM_OPTIONS } from "../../lib/campaign-stages";
import type { CampaignStatus, Platform, Product, User } from "../../lib/types";

const LANGUAGES = ["Hindi / Hinglish", "English", "Telugu", "Tamil"];

interface ProductGoalRow {
  productId: number | "";
  targetVideos: string;
}

interface ParticipantRow {
  userId: number | "";
  allocation: string;
  mandatory: boolean;
}

type Step = 1 | 2 | 3;

export function NewCampaignWizard({
  products,
  advisors,
  onClose,
  onCreated,
}: {
  products: Product[];
  advisors: User[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);

  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("draft");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [demographic, setDemographic] = useState("");
  const [language, setLanguage] = useState(LANGUAGES[0]);

  const [targetVideos, setTargetVideos] = useState("");
  const [creatorsNeeded, setCreatorsNeeded] = useState("");
  const [productRows, setProductRows] = useState<ProductGoalRow[]>([]);

  const [participantRows, setParticipantRows] = useState<ParticipantRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((v) => v !== p) : [...prev, p]));
  }

  function addProductRow() {
    setProductRows((rows) => [...rows, { productId: products[0]?.id ?? "", targetVideos: "" }]);
  }
  function updateProductRow(index: number, patch: Partial<ProductGoalRow>) {
    setProductRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeProductRow(index: number) {
    setProductRows((rows) => rows.filter((_, i) => i !== index));
  }

  function addParticipantRow() {
    setParticipantRows((rows) => [...rows, { userId: advisors[0]?.id ?? "", allocation: "", mandatory: false }]);
  }
  function updateParticipantRow(index: number, patch: Partial<ParticipantRow>) {
    setParticipantRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeParticipantRow(index: number) {
    setParticipantRows((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    const target = Number(targetVideos) || 0;
    const committed = participantRows.reduce((sum, r) => sum + (Number(r.allocation) || 0), 0);
    if (committed > target) {
      setError(`Participant allocations (${committed}) exceed the campaign target (${target}).`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/campaigns", {
        name,
        status,
        target_videos: target,
        creators_needed: creatorsNeeded ? Number(creatorsNeeded) : null,
        deadline: deadline || null,
        demographic: demographic || null,
        language: language || null,
        platforms,
        products: productRows
          .filter((r) => r.productId)
          .map((r) => ({ product_id: r.productId, target_videos: Number(r.targetVideos) || 0 })),
        participants: participantRows
          .filter((r) => r.userId)
          .map((r) => ({ user_id: r.userId, allocation: Number(r.allocation) || 0, is_mandatory: r.mandatory })),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not create campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 flex h-full w-[480px] flex-col bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div>
            <h2 className="text-base font-semibold text-ink">Create campaign</h2>
            <p className="text-xs text-gray-500">Set a campaign target, invite participants and leave capacity open.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-[#e7e5e4] px-5 py-3 text-xs font-semibold text-gray-400">
          <span className={step === 1 ? "text-brand-600" : ""}>1. Details</span>
          <span>·</span>
          <span className={step === 2 ? "text-brand-600" : ""}>2. Targets</span>
          <span>·</span>
          <span className={step === 3 ? "text-brand-600" : ""}>3. Team</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <>
              <label className="mb-1 block text-sm font-medium text-gray-700">Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Campaign status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {CAMPAIGN_STATUS_ORDER.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <label className="mb-1 block text-sm font-medium text-gray-700">Platforms</label>
              <div className="mb-3 flex gap-3">
                {PLATFORM_OPTIONS.map((p) => (
                  <label key={p.key} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input type="checkbox" checked={platforms.includes(p.key)} onChange={() => togglePlatform(p.key)} />
                    {p.label}
                  </label>
                ))}
              </div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Target demographic</label>
              <input
                value={demographic}
                onChange={(e) => setDemographic(e.target.value)}
                placeholder="Women 18-35 · Tier 1 & 2"
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </>
          )}

          {step === 2 && (
            <>
              <label className="mb-1 block text-sm font-medium text-gray-700">Total campaign target (videos)</label>
              <input
                type="number"
                min={0}
                value={targetVideos}
                onChange={(e) => setTargetVideos(e.target.value)}
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-sm font-medium text-gray-700">Creators needed</label>
              <input
                type="number"
                min={0}
                value={creatorsNeeded}
                onChange={(e) => setCreatorsNeeded(e.target.value)}
                className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />

              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Product goals</span>
                <button
                  type="button"
                  onClick={addProductRow}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                >
                  <Plus size={12} /> Add product
                </button>
              </div>
              <p className="mb-2 text-xs text-gray-400">
                Product goals guide the mix; they don't have to sum to the campaign target.
              </p>
              {productRows.map((row, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <select
                    value={row.productId}
                    onChange={(e) => updateProductRow(i, { productId: Number(e.target.value) })}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    placeholder="Goal"
                    value={row.targetVideos}
                    onChange={(e) => updateProductRow(i, { targetVideos: e.target.value })}
                    className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <button type="button" onClick={() => removeProductRow(i)} className="text-gray-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Participants</span>
                <button
                  type="button"
                  onClick={addParticipantRow}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                >
                  <Plus size={12} /> Add participant
                </button>
              </div>
              <p className="mb-2 text-xs text-gray-400">
                Mandatory applies to a user commitment. Unassigned capacity stays open for others to self-join.
              </p>
              {participantRows.map((row, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <select
                    value={row.userId}
                    onChange={(e) => updateParticipantRow(i, { userId: Number(e.target.value) })}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {advisors.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    placeholder="Allocation"
                    value={row.allocation}
                    onChange={(e) => updateParticipantRow(i, { allocation: e.target.value })}
                    className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={row.mandatory}
                      onChange={(e) => updateParticipantRow(i, { mandatory: e.target.checked })}
                    />
                    Mandatory
                  </label>
                  <button type="button" onClick={() => removeParticipantRow(i)} className="text-gray-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
              ))}
              {participantRows.length === 0 && (
                <p className="text-xs text-gray-400">No participants added yet — open capacity stays fully unassigned.</p>
              )}
            </>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-[#e7e5e4] p-4">
          <div className="flex justify-end gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={step === 1 && !name.trim()}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Continue →
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create campaign"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
