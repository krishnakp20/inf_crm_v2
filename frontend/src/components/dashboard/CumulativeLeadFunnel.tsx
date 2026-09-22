import type { FunnelStage } from "../../lib/types";

const VIEW_WIDTH = 640;
const ROW_HEIGHT = 42;
const MIN_WIDTH_FRACTION = 0.14;
const TOP_RADIUS = 10;

function widthFraction(count: number, maxCount: number): number {
  if (count <= 0) return 0;
  return Math.max(count / maxCount, MIN_WIDTH_FRACTION);
}

export function CumulativeLeadFunnel({ funnel }: { funnel: FunnelStage[] }) {
  const maxCount = Math.max(...funnel.map((s) => s.count), 1);
  const totalHeight = funnel.length * ROW_HEIGHT;

  return (
    <div className="dashboard-card p-5">
      <h2 className="text-[15px] font-normal text-ink">Cumulative lead funnel</h2>
      <p className="mt-1 text-[10px] text-muted">Stage-by-stage lead volume, from first touch to Ads live</p>

      {funnel.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No pipeline data yet.</p>
      ) : (
        <div className="mt-4 flex items-start gap-4">
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${totalHeight}`} className="min-w-0 flex-1" style={{ height: totalHeight }}>
            <defs>
              <linearGradient id="funnelGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5B5CE2" />
                <stop offset="100%" stopColor="#c7c6f8" />
              </linearGradient>
              <clipPath id="funnelClip">
                <rect x="0" y="0" width={VIEW_WIDTH} height={totalHeight} rx={TOP_RADIUS} />
              </clipPath>
            </defs>
            <g clipPath="url(#funnelClip)">
              {funnel.map((stage, i) => {
                const next = funnel[i + 1];
                const topFrac = widthFraction(stage.count, maxCount);
                const bottomFrac = next ? widthFraction(next.count, maxCount) : topFrac * 0.9;
                const topWidth = topFrac * VIEW_WIDTH;
                const bottomWidth = bottomFrac * VIEW_WIDTH;
                const y = i * ROW_HEIGHT;
                const topLeft = (VIEW_WIDTH - topWidth) / 2;
                const bottomLeft = (VIEW_WIDTH - bottomWidth) / 2;
                const points = [
                  [topLeft, y],
                  [topLeft + topWidth, y],
                  [bottomLeft + bottomWidth, y + ROW_HEIGHT],
                  [bottomLeft, y + ROW_HEIGHT],
                ]
                  .map((p) => p.join(","))
                  .join(" ");
                return (
                  <g key={stage.stage}>
                    <polygon points={points} fill="url(#funnelGradient)" stroke="#fff" strokeWidth={1.5} />
                    <text
                      x={VIEW_WIDTH / 2}
                      y={y + ROW_HEIGHT / 2 + 4}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize={11}
                      fontWeight={700}
                    >
                      {stage.label} · {stage.count}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="flex shrink-0 flex-col justify-between py-0.5" style={{ height: totalHeight }}>
            {funnel.map((stage, i) => (
              <div key={stage.stage} className="flex items-center text-[9px] text-muted" style={{ height: ROW_HEIGHT }}>
                {i === 0 ? "—" : `${stage.conversion_pct ?? 0}% from prev`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
