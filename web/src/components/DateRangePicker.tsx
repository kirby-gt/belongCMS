import { useMemo } from "react";
import { iso, thisMonthRange, type DateRange } from "../dateRange";

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: Props) {
  const presets = useMemo<{ label: string; range: () => DateRange }[]>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return [
      { label: "This month", range: () => thisMonthRange() },
      {
        label: "Last month",
        range: () => ({ start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) }),
      },
      {
        label: "This quarter",
        range: () => ({ start: iso(new Date(y, Math.floor(m / 3) * 3, 1)), end: iso(now) }),
      },
      { label: "Year to date", range: () => ({ start: iso(new Date(y, 0, 1)), end: iso(now) }) },
    ];
  }, []);

  return (
    <div className="date-range-picker">
      <label>
        From
        <input
          type="date"
          value={value.start}
          max={value.end || undefined}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={value.end}
          min={value.start || undefined}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
        />
      </label>
      <div className="date-range-presets">
        {presets.map((p) => (
          <button type="button" key={p.label} className="chip-btn" onClick={() => onChange(p.range())}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
