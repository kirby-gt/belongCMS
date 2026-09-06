import { useEffect, useState } from "react";
import { api } from "../api";
import ReportView from "../components/ReportView";
import { downloadCsv } from "../reportCsv";

interface Row {
  id: string;
  full_name: string;
  membership_status: string;
  phone: string | null;
  email: string | null;
  last_seen: string;
  days_since: number;
  weeks_since: number;
  ministries: string[];
}

interface Data {
  generated_at: string;
  weeks: number;
  statuses: string[];
  rows: Row[];
}

const STATUS_PRESETS = [
  { label: "Members & new converts", value: "Member,New convert" },
  { label: "Members only", value: "Member" },
  { label: "Members, new converts & inactive", value: "Member,New convert,Inactive" },
];

export default function ReportAbsentees() {
  const [weeks, setWeeks] = useState("6");
  const [status, setStatus] = useState(STATUS_PRESETS[0].value);
  const [ministryId, setMinistryId] = useState("");
  const [ministries, setMinistries] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMinistries().then(setMinistries).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params: { weeks: string; status: string; ministry_id?: string } = { weeks, status };
    if (ministryId) params.ministry_id = ministryId;
    api
      .getAbsenteesReport(params)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load report"))
      .finally(() => setLoading(false));
  }, [weeks, status, ministryId]);

  const rows = data?.rows ?? [];

  function handleCsv() {
    downloadCsv(
      `absentees_${weeks}wk`,
      rows.map((r) => ({
        name: r.full_name,
        status: r.membership_status,
        ministries: r.ministries.join("; "),
        last_seen: r.last_seen,
        weeks_since: r.weeks_since,
        phone: r.phone ?? "",
        email: r.email ?? "",
      }))
    );
  }

  return (
    <ReportView
      title="Absentee / at-risk list"
      description="Members who have been present at least once but not in the last N weeks — oldest absence first."
      filters={
        <div className="report-filter-bar">
          <label className="report-field">
            No attendance for
            <select value={weeks} onChange={(e) => setWeeks(e.target.value)}>
              <option value="4">4 weeks</option>
              <option value="6">6 weeks</option>
              <option value="8">8 weeks</option>
              <option value="12">12 weeks</option>
            </select>
          </label>
          <label className="report-field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_PRESETS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="report-field">
            Ministry
            <select value={ministryId} onChange={(e) => setMinistryId(e.target.value)}>
              <option value="">All ministries</option>
              {ministries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      onDownloadCsv={handleCsv}
      canDownload={rows.length > 0}
      loading={loading && !data}
      error={error}
      generatedAt={data?.generated_at}
      filterSummary={data ? `No attendance in ${data.weeks} weeks · ${data.statuses.join(", ")}` : undefined}
    >
      <p className="report-status no-print">{rows.length} member{rows.length === 1 ? "" : "s"}</p>
      {rows.length === 0 ? (
        <p className="report-status">Nobody in that group has been absent that long.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Ministries</th>
                <th>Last seen</th>
                <th>Weeks</th>
                <th>Phone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{r.membership_status}</td>
                  <td>{r.ministries.join(", ") || "—"}</td>
                  <td>{r.last_seen}</td>
                  <td>{r.weeks_since}</td>
                  <td>{r.phone || "—"}</td>
                  <td>{r.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportView>
  );
}
