import type { FunnelStage } from "../../lib/types";

const VIEW_WIDTH = 640;
const ROW_HEIGHT = 42;
// Even the smallest stage (or one with 0 leads) keeps a bar wide enough to hold its label.
const MIN_WIDTH_FRACTION = 0.34;
const TOP_RADIUS = 10;
// Every stage is a solid fill dark enough for white text (white on #5B5CE2 is 5.1:1, on the darkest 8:1);
// the funnel still gets darker toward the top. Labels that do not fit inside their bar are drawn
// to the right of it in dark ink (a safety net for very long labels), so no label is ever white on white.
const FILL_TOP = [0x3b, 0x3c, 0xc2];
const FILL_BOTTOM = [0x5b, 0x5c, 0xe2];
const LABEL_INK = "#1c1a25";
const CHAR_WIDTH = 6.8; // bold 11px, with a little spare

function stageFill(i: number, total: number): string {
  const t = total > 1 ? i / (total - 1) : 0;
  return `rgb(${FILL_TOP.map((c, k) => Math.round(c + (FILL_BOTTOM[k] - c) * t)).join(",")})`;
}

function widthFraction(count: number, maxCount: number): number {
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
                const label = `${stage.label} · ${stage.count}`;
                const midWidth = (topWidth + bottomWidth) / 2;
                const fitsInside = label.length * CHAR_WIDTH + 16 <= midWidth;
                return (
                  <g key={stage.stage}>
                    <polygon points={points} fill={stageFill(i, funnel.length)} stroke="#fff" strokeWidth={1.5} />
                    <text
                      x={fitsInside ? VIEW_WIDTH / 2 : VIEW_WIDTH / 2 + midWidth / 2 + 10}
                      y={y + ROW_HEIGHT / 2 + 4}
                      textAnchor={fitsInside ? "middle" : "start"}
                      fill={fitsInside ? "#fff" : LABEL_INK}
                      fontSize={11}
                      fontWeight={700}
                    >
                      {label}
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
