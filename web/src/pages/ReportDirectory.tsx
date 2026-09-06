import { useEffect, useState } from "react";
import { api } from "../api";
import ReportView from "../components/ReportView";
import { downloadCsv } from "../reportCsv";

interface Row {
  id: string;
  full_name: string;
  membership_status: string;
  gender: string | null;
  marital_status: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  date_joined: string | null;
  household_name: string | null;
  ministries: string[];
}

interface Data {
  generated_at: string;
  count: number;
  rows: Row[];
}

const STATUSES = ["Visitor", "New convert", "Member", "Inactive"];

export default function ReportDirectory() {
  const [status, setStatus] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [sort, setSort] = useState("name");
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
    const params: Record<string, string> = { sort };
    if (status) params.status = status;
    if (ministryId) params.ministry_id = ministryId;
    api
      .getMemberDirectoryReport(params)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load report"))
      .finally(() => setLoading(false));
  }, [status, ministryId, sort]);

  const rows = data?.rows ?? [];

  function handleCsv() {
    downloadCsv(
      "member-directory",
      rows.map((r) => ({
        name: r.full_name,
        status: r.membership_status,
        household: r.household_name ?? "",
        ministries: r.ministries.join("; "),
        gender: r.gender ?? "",
        marital_status: r.marital_status ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
        address: r.address ?? "",
        date_of_birth: r.date_of_birth ?? "",
        date_joined: r.date_joined ?? "",
      }))
    );
  }

  return (
    <ReportView
      title="Member directory"
      description="The full membership list with household and ministry assignments."
      filters={
        <div className="report-filter-bar">
          <label className="report-field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
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
          <label className="report-field">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Name</option>
              <option value="household">Household</option>
            </select>
          </label>
        </div>
      }
      onDownloadCsv={handleCsv}
      canDownload={rows.length > 0}
      loading={loading && !data}
      error={error}
      generatedAt={data?.generated_at}
      filterSummary={`${data?.count ?? 0} members`}
    >
      <p className="report-status no-print">{data?.count ?? 0} members</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Household</th>
              <th>Ministries</th>
              <th>Phone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.full_name}</td>
                <td>{r.membership_status}</td>
                <td>{r.household_name || "—"}</td>
                <td>{r.ministries.join(", ") || "—"}</td>
                <td>{r.phone || "—"}</td>
                <td>{r.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportView>
  );
}
