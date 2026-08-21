import { useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  formatValue?: (v: number) => string;
}

export default function BarChart({ data, formatValue = (v) => String(v) }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="chart-empty">No data yet.</p>;
  }

  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div
          className="bar-row"
          key={d.label}
          tabIndex={0}
          title={`${d.label}: ${formatValue(d.value)}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(i)}
          onBlur={() => setHovered(null)}
        >
          <span className="bar-row-label">{d.label}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color ?? "var(--chart-primary)",
                opacity: hovered === null || hovered === i ? 1 : 0.55,
              }}
            />
          </span>
          <span className="bar-row-value">{formatValue(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
