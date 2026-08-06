import { useState } from "react";
import { api } from "../../lib/api";

interface Match {
  id: number;
  name: string;
  instagram_handle: string;
  owner_id: number;
  current_stage: string;
}

export function OwnershipCheck({ owners }: { owners: Record<number, string> }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [checking, setChecking] = useState(false);

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
                <li key={m.id} className="text-amber-700">
                  @{m.instagram_handle} is already owned by {owners[m.owner_id] ?? "another advisor"} (
                  {m.current_stage.replace("_", " ")})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
