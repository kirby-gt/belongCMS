import { useEffect, useState } from "react";
import { api } from "../api";
import ReportView from "../components/ReportView";
import DateRangePicker from "../components/DateRangePicker";
import { thisMonthRange, type DateRange } from "../dateRange";
import { downloadCsv } from "../reportCsv";

interface ServiceRow {
  id: string;
  service_date: string;
  service_type: string;
  name: string | null;
  visitor_count: number | null;
  present: number;
  visitors_present: number;
  visitor_checkins: number;
}

interface PeriodSummary {
  service_count: number;
  attended_service_count: number;
  total_present: number;
  average_attendance: number | null;
  sunday_service_count: number;
  sunday_average_attendance: number | null;
  total_visitors: number;
}

interface Data {
  generated_at: string;
  start: string;
  end: string;
  compare: { start: string; end: string };
  summary: PeriodSummary;
  compare_summary: PeriodSummary;
  services: ServiceRow[];
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function delta(a: number | null, b: number | null) {
  if (a == null || b == null) return "—";
  const d = a - b;
  return d === 0 ? "±0" : d > 0 ? `+${d}` : `${d}`;
}

export default function ReportAttendanceSummary() {
  const [range, setRange] = useState<DateRange>(thisMonthRange);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!range.start || !range.end) return;
    setLoading(true);
    setError("");
    api
      .getAttendanceSummaryReport(range.start, range.end)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load report"))
      .finally(() => setLoading(false));
  }, [range.start, range.end]);

  const rows = data?.services ?? [];

  function handleCsv() {
    downloadCsv(
      `attendance-summary_${range.start}_${range.end}`,
      rows.map((s) => ({
        date: s.service_date,
        type: s.service_type,
        event: s.name ?? "",
        present: s.present,
        visitors_present_members: s.visitors_present,
        visitor_checkins: s.visitor_checkins,
        visitor_headcount: s.visitor_count ?? "",
      }))
    );
  }

  const s = data?.summary;
  const p = data?.compare_summary;

  return (
    <ReportView
      title="Attendance summary"
      description="Totals and averages over the selected range, next to the previous range of the same length. Averages count only services that had attendance taken."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      onDownloadCsv={handleCsv}
      canDownload={rows.length > 0}
      loading={loading && !data}
      error={error}
      generatedAt={data?.generated_at}
      filterSummary={
        data ? `${data.start} to ${data.end}  (vs ${data.compare.start} to ${data.compare.end})` : undefined
      }
    >
      {data && s && p && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>This period</th>
                  <th>Previous period</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Services held</td>
                  <td>{s.service_count}</td>
                  <td>{p.service_count}</td>
                  <td>{delta(s.service_count, p.service_count)}</td>
                </tr>
                <tr>
                  <td>Average attendance</td>
                  <td>{s.average_attendance ?? "—"}</td>
                  <td>{p.average_attendance ?? "—"}</td>
                  <td>{delta(s.average_attendance, p.average_attendance)}</td>
                </tr>
                <tr>
                  <td>Sunday average</td>
                  <td>{s.sunday_average_attendance ?? "—"}</td>
                  <td>{p.sunday_average_attendance ?? "—"}</td>
                  <td>{delta(s.sunday_average_attendance, p.sunday_average_attendance)}</td>
                </tr>
                <tr>
                  <td>Total present (all services)</td>
                  <td>{s.total_present}</td>
                  <td>{p.total_present}</td>
                  <td>{delta(s.total_present, p.total_present)}</td>
                </tr>
                <tr>
                  <td>Total visitors</td>
                  <td>{s.total_visitors}</td>
                  <td>{p.total_visitors}</td>
                  <td>{delta(s.total_visitors, p.total_visitors)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="report-subhead">
            Services in this period <span className="report-count">({rows.length})</span>
          </h2>
          {rows.length === 0 ? (
            <p className="report-status">No services recorded in this range.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Event</th>
                    <th>Present</th>
                    <th>Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.service_date)}</td>
                      <td>{r.service_type}</td>
                      <td>{r.name ?? "—"}</td>
                      <td>{r.present}</td>
                      <td>{r.visitor_count ?? r.visitor_checkins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ReportView>
  );
}
