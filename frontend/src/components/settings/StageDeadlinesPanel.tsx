import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface StageDeadlineRule {
  stage: string;
  label: string;
  max_days: number | null;
}

export function StageDeadlinesPanel() {
  const [rules, setRules] = useState<StageDeadlineRule[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function load() {
    api.get<StageDeadlineRule[]>("/settings/stage-deadlines").then((res) => {
      setRules(res.data);
      setDraft(Object.fromEntries(res.data.map((r) => [r.stage, r.max_days?.toString() ?? ""])));
      setSaved(false);
    });
  }

  useEffect(load, []);

  const isDirty = rules.some((r) => draft[r.stage] !== (r.max_days?.toString() ?? ""));

  async function publish() {
    setSaving(true);
    try {
      await api.put("/settings/stage-deadlines", {
        rules: rules.map((r) => ({
          stage: r.stage,
          max_days: draft[r.stage] ? Number(draft[r.stage]) : null,
        })),
      });
      load();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(Object.fromEntries(rules.map((r) => [r.stage, r.max_days?.toString() ?? ""])));
  }

  return (
    <div className="dashboard-card p-5">
      <h2 className="mb-1 text-base font-semibold text-ink">Stage deadlines</h2>
      <p className="mb-4 text-sm text-gray-500">
        Set how long a lead can remain in each stage before it needs attention.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400">
              <th className="pb-2">Stage</th>
              <th className="pb-2">Maximum time in stage</th>
              <th className="pb-2">Dashboard result</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, idx) => (
              <tr key={r.stage} className="border-t border-gray-100">
                <td className="py-3 text-ink">
                  {idx + 1}. {r.label}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={draft[r.stage] ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [r.stage]: e.target.value }))}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-gray-400">days</span>
                  </div>
                </td>
                <td className="py-3 text-xs text-gray-500">
                  {draft[r.stage] ? `Highlight after ${draft[r.stage]} days` : "No deadline"}
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-100">
              <td className="py-3 text-ink">{rules.length + 1}. Content live</td>
              <td className="py-3 text-xs text-gray-400">No deadline</td>
              <td className="py-3 text-xs text-gray-400">Completed</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-xs text-gray-400">
          {saved ? "Saved -- changes apply to every user's dashboard." : "Unsaved changes are local until published."}
        </span>
        <div className="flex gap-2">
          <button
            onClick={discard}
            disabled={!isDirty}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Discard
          </button>
          <button
            onClick={publish}
            disabled={!isDirty || saving}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Publishing..." : "Publish changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
