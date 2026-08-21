import { useState, type MouseEvent } from "react";

export interface LinePoint {
  x: string;
  y: number;
}

interface LineChartProps {
  data: LinePoint[];
  formatValue?: (v: number) => string;
  formatX?: (x: string) => string;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD_LEFT = 38;
const PAD_RIGHT = 30;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * Math.pow(10, exponent);
}

export default function LineChart({ data, formatValue = (v) => String(v), formatX = (x) => x }: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="chart-empty">No data yet.</p>;
  }

  const max = niceMax(Math.max(...data.map((d) => d.y)));
  const xStep = data.length > 1 ? PLOT_W / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    ...d,
    px: PAD_LEFT + i * xStep,
    py: PAD_TOP + PLOT_H - (d.y / max) * PLOT_H,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.px},${p.py}`).join(" ");
  const baseline = PAD_TOP + PLOT_H;
  const areaPath = `${linePath} L${points[points.length - 1].px},${baseline} L${points[0].px},${baseline} Z`;

  const last = points[points.length - 1];
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const idx = xStep > 0 ? Math.round((relX - PAD_LEFT) / xStep) : 0;
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
  }

  // Show every label if there's room, otherwise thin them out.
  const labelStride = Math.ceil(points.length / 8);

  return (
    <div className="line-chart-wrap">
      <svg
        className="line-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0, 0.5, 1].map((t) => {
          const y = PAD_TOP + PLOT_H - t * PLOT_H;
          return (
            <g key={t}>
              <line x1={PAD_LEFT} y1={y} x2={WIDTH - PAD_RIGHT} y2={y} className="line-chart-grid" />
              <text x={PAD_LEFT - 8} y={y + 3} className="line-chart-tick" textAnchor="end">
                {Math.round(max * t)}
              </text>
            </g>
          );
        })}

        {points.map((p, i) =>
          i % labelStride === 0 || i === points.length - 1 ? (
            <text key={p.x} x={p.px} y={HEIGHT - 6} className="line-chart-tick" textAnchor="middle">
              {formatX(p.x)}
            </text>
          ) : null
        )}

        <path d={areaPath} className="line-chart-area" />
        <path d={linePath} className="line-chart-line" />

        {hovered && (
          <line
            x1={hovered.px}
            y1={PAD_TOP}
            x2={hovered.px}
            y2={baseline}
            className="line-chart-crosshair"
          />
        )}

        <circle cx={last.px} cy={last.py} r="5" className="line-chart-dot" />
        <text
          x={last.px + 10}
          y={last.py + 4}
          className="line-chart-end-label"
          textAnchor="start"
        >
          {formatValue(last.y)}
        </text>

        {hovered && hovered !== last && (
          <circle cx={hovered.px} cy={hovered.py} r="5" className="line-chart-dot" />
        )}
      </svg>

      {hovered && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(hovered.px / WIDTH) * 100}%`,
            top: `${(hovered.py / HEIGHT) * 100}%`,
          }}
        >
          <strong>{formatValue(hovered.y)}</strong>
          <span>{formatX(hovered.x)}</span>
        </div>
      )}
    </div>
  );
}
