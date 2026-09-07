import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FunnelStage } from "../../lib/types";

const ACCENT = "#5B5CE2";

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: { payload: FunnelStage & { count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const stage = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 shadow-lg">
      <div className="flex items-center gap-1.5">
        <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
        <span className="text-xs font-semibold text-ink">{stage.count.toLocaleString()}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-gray-400">{stage.label}</div>
    </div>
  );
}

export function FunnelTrendChart({ funnel }: { funnel: FunnelStage[] }) {
  const hasData = funnel.some((f) => f.count > 0);

  return (
    <div className="dashboard-card p-5">
      <h2 className="text-[15px] font-normal text-ink">Funnel trend</h2>
      <p className="mt-1 text-[10px] text-muted">How the pipeline narrows from lead to live, for the selected scope and date range</p>

      {hasData ? (
        <>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={funnel} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#edecf0" strokeWidth={1} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#99949e" }}
                  axisLine={{ stroke: "#edecf0" }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#99949e" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<FunnelTooltip />} cursor={{ stroke: "#edecf0", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={ACCENT}
                  strokeWidth={2}
                  fill={ACCENT}
                  fillOpacity={0.1}
                  dot={{ r: 4, fill: ACCENT, stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: ACCENT, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[#e7e5e4] pt-3">
            {funnel.map((stage) => (
              <div key={stage.stage} className="flex items-baseline gap-1 text-[11px]">
                <span className="font-semibold text-ink">{stage.count.toLocaleString()}</span>
                <span className="text-gray-400">{stage.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-400">No collaborations in this scope yet.</p>
      )}
    </div>
  );
}
