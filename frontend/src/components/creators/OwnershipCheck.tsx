import { useState } from "react";
import { api } from "../../lib/api";

interface Match {
  id: number;
  name: string;
  instagram_handle: string;
  owner_id: number;
  current_stage_label: string | null;
  current_collaboration_id: number | null;
}

export function OwnershipCheck({
  owners,
  onRevived,
}: {
  owners: Record<number, string>;
  /** Called after successfully reviving a Dead Leads match, so the caller
   * can refresh whatever list is showing this creator's now-changed
   * stage/archived status. */
  onRevived?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [revivingId, setRevivingId] = useState<number | null>(null);

  async function handleRevive(match: Match) {
    if (!match.current_collaboration_id) return;
    setRevivingId(match.id);
    try {
      await api.post(`/collaborations/${match.current_collaboration_id}/clone`);
      // Re-run the same check instead of just dropping the match from the
      // list -- they're still owned by the same advisor, just no longer
      // dead, so "no existing owner found" would be a misleading thing to
      // show right after a successful revive.
      await handleCheck();
      onRevived?.();
    } finally {
      setRevivingId(null);
    }
  }

  function normalizeQuery(raw: string): string {
    let value = raw.trim();
    if (/instagram\.com/i.test(value)) {
      value = value.split("?")[0].replace(/\/+$/, "").split("/").pop() ?? value;
    }
    return value.replace(/^@/, "");
  }

  async function handleCheck() {
    const normalized = normalizeQuery(query);
    if (normalized.length < 2) return;
    setChecking(true);
    try {
      const { data } = await api.get<Match[]>("/creators/check-ownership", { params: { query: normalized } });
      setMatches(data);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mb-6 dashboard-card p-5">
      <h2 className="text-base font-semibold text-ink">Check before you contact</h2>
      <p className="mt-1 text-sm text-gray-500">
        Search Instagram username, profile link or phone number to prevent creator clashes.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste @username, profile URL or phone"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={handleCheck}
          disabled={checking}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Check ownership
        </button>
      </div>
      {matches !== null && (
        <div className="mt-3 text-sm">
          {matches.length === 0 ? (
            <p className="text-emerald-600">No existing owner found — safe to contact.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-amber-700">
                  <span>
                    @{m.instagram_handle} is already owned by {owners[m.owner_id] ?? "another advisor"}
                    {m.current_stage_label ? ` (${m.current_stage_label})` : ""}
                  </span>
                  {m.current_stage_label === "Dead Leads" && m.current_collaboration_id && (
                    <button
                      onClick={() => handleRevive(m)}
                      disabled={revivingId === m.id}
                      className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {revivingId === m.id ? "Reviving..." : "Revive as a new lead"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
