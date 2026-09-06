import { useEffect, useState } from "react";
import { api } from "../api";
import ReportView from "../components/ReportView";
import { downloadCsv } from "../reportCsv";

interface Member {
  member_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  membership_status: string;
}

interface MinistryGroup {
  ministry_id: string;
  ministry_name: string;
  member_count: number;
  members: Member[];
}

interface Data {
  generated_at: string;
  ministries: MinistryGroup[];
}

export default function ReportMinistryRoster() {
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
    api
      .getMinistryRosterReport(ministryId || undefined)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load report"))
      .finally(() => setLoading(false));
  }, [ministryId]);

  const groups = data?.ministries ?? [];
  const totalMembers = groups.reduce((n, g) => n + g.member_count, 0);

  function handleCsv() {
    const rows = groups.flatMap((g) =>
      g.members.map((m) => ({
        ministry: g.ministry_name,
        name: m.full_name,
        status: m.membership_status,
        phone: m.phone ?? "",
        email: m.email ?? "",
      }))
    );
    downloadCsv("ministry-roster", rows);
  }

  return (
    <ReportView
      title="Ministry roster"
      description="Members in each ministry with contact details."
      filters={
        <div className="report-filter-bar">
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
      canDownload={totalMembers > 0}
      loading={loading && !data}
      error={error}
      generatedAt={data?.generated_at}
      filterSummary={ministryId ? groups[0]?.ministry_name : "All ministries"}
    >
      {groups.length === 0 ? (
        <p className="report-status">No ministries yet.</p>
      ) : (
        groups.map((g) => (
          <div key={g.ministry_id} className="ministry-group">
            <h2 className="report-subhead">
              {g.ministry_name} <span className="report-count">({g.member_count})</span>
            </h2>
            {g.members.length === 0 ? (
              <p className="report-status">No members assigned.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Phone</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.members.map((m) => (
                      <tr key={m.member_id}>
                        <td>{m.full_name}</td>
                        <td>{m.membership_status}</td>
                        <td>{m.phone || "—"}</td>
                        <td>{m.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </ReportView>
  );
}
