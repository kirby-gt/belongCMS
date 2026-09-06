import { useEffect, useState } from "react";
import { api } from "../api";
import ReportView from "../components/ReportView";
import { downloadCsv } from "../reportCsv";

interface Item {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  day: number;
  years: number;
}

interface Data {
  generated_at: string;
  month: string;
  birthdays: Item[];
  baptism_anniversaries: Item[];
  membership_anniversaries: Item[];
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function ReportMilestones() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!month) return;
    setLoading(true);
    setError("");
    api
      .getMilestonesReport(month)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load report"))
      .finally(() => setLoading(false));
  }, [month]);

  const monthName = data
    ? new Date(Number(data.month.slice(0, 4)), Number(data.month.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, {
        month: "long",
      })
    : "";
  const monthLabel = data
    ? new Date(Number(data.month.slice(0, 4)), Number(data.month.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "";

  function handleCsv() {
    if (!data) return;
    const tag = (t: string) => (i: Item) => ({
      type: t,
      day: i.day,
      name: i.full_name,
      years: i.years,
      phone: i.phone ?? "",
      email: i.email ?? "",
    });
    downloadCsv(`milestones_${data.month}`, [
      ...data.birthdays.map(tag("Birthday")),
      ...data.baptism_anniversaries.map(tag("Baptism anniversary")),
      ...data.membership_anniversaries.map(tag("Membership anniversary")),
    ]);
  }

  function section(title: string, items: Item[], yearsLabel: string) {
    return (
      <div className="milestone-group">
        <h2 className="report-subhead">
          {title} <span className="report-count">({items.length})</span>
        </h2>
        {items.length === 0 ? (
          <p className="report-status">None this month.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Name</th>
                  <th>{yearsLabel}</th>
                  <th>Phone</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {monthName} {ordinal(i.day)}
                    </td>
                    <td>{i.full_name}</td>
                    <td>{i.years}</td>
                    <td>{i.phone || "—"}</td>
                    <td>{i.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const total = data
    ? data.birthdays.length + data.baptism_anniversaries.length + data.membership_anniversaries.length
    : 0;

  return (
    <ReportView
      title="Birthdays & anniversaries"
      description="Birthdays, baptism anniversaries and membership anniversaries falling in the selected month."
      filters={
        <div className="report-filter-bar">
          <label className="report-field">
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        </div>
      }
      onDownloadCsv={handleCsv}
      canDownload={total > 0}
      loading={loading && !data}
      error={error}
      generatedAt={data?.generated_at}
      filterSummary={monthLabel}
    >
      {data && (
        <>
          {section("Birthdays", data.birthdays, "Turning")}
          {section("Baptism anniversaries", data.baptism_anniversaries, "Years")}
          {section("Membership anniversaries", data.membership_anniversaries, "Years")}
        </>
      )}
    </ReportView>
  );
}
