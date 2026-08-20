import { useState } from "react";
import type { AnalyticsWhatIsWorking, AnalyticsWhatIsWorkingRow } from "../../lib/types";

type Dimension = "content_bucket" | "language" | "creator_category";

const DIMENSION_LABELS: Record<Dimension, string> = {
  content_bucket: "Content bucket",
  language: "Language",
  creator_category: "Creator category",
};

function RankingTable({ dimensionLabel, rows }: { dimensionLabel: string; rows: AnalyticsWhatIsWorkingRow[] }) {
  return (
    <div className="dashboard-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e7e5e4] bg-surface text-left">
              <th className="w-8 py-2.5 pl-4 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]">#</th>
              <th className="py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]">{dimensionLabel}</th>
              <th className="py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]">Videos</th>
              <th className="py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]">Views</th>
              <th className="py-2.5 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]">Comments</th>
              <th className="py-2.5 pr-4 text-[7px] font-extrabold uppercase tracking-wide text-[#918d97]">Hit rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.dimension_value} className="border-t border-gray-100">
                <td className="py-2.5 pl-4 pr-3 text-[8px] font-bold text-gray-400">{row.rank}</td>
                <td className="py-2.5 pr-3 text-[9px] font-extrabold text-ink">{row.dimension_value}</td>
                <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.videos}</td>
                <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.views.toLocaleString("en-IN")}</td>
                <td className="py-2.5 pr-3 text-[8px] text-[#55515c]">{row.comments.toLocaleString("en-IN")}</td>
                <td className="py-2.5 pr-4 text-[8px] font-semibold text-[#55515c]">{row.hit_rate_pct}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-gray-400">
                  No data for this dimension yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WhatIsWorkingPanel({ data }: { data: AnalyticsWhatIsWorking }) {
  const [dimension, setDimension] = useState<Dimension>("content_bucket");

  return (
    <div className="mb-4">
      <h3 className="mb-0.5 text-sm font-semibold text-ink">What is working</h3>
      <p className="mb-2 text-xs text-muted">Rank one dimension at a time for a cleaner comparison.</p>
      <div className="mb-2 flex items-center gap-1.5">
        {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((d) => (
          <button
            key={d}
            onClick={() => setDimension(d)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              dimension === d ? "bg-brand-100 text-brand-600" : "text-gray-500 hover:bg-surface"
            }`}
          >
            {DIMENSION_LABELS[d]}
          </button>
        ))}
      </div>
      <RankingTable dimensionLabel={DIMENSION_LABELS[dimension]} rows={data[dimension]} />
    </div>
  );
}
