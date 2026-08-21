import { useEffect, useState } from "react";
import { api } from "../api";
import StatCard from "../components/charts/StatCard";
import ChartCard from "../components/charts/ChartCard";
import BarChart from "../components/charts/BarChart";
import LineChart from "../components/charts/LineChart";

interface DashboardSummary {
  totals: { members: number; households: number; ministries: number };
  members_by_status: { status: string; count: number }[];
  members_by_ministry: { name: string; count: number }[];
  membership_growth: { month: string; count: number }[];
  attendance_trend: { service_date: string; service_type: string; present: number; total: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  Visitor: "var(--chart-status-1)",
  "New convert": "var(--chart-status-2)",
  Member: "var(--chart-status-3)",
  Inactive: "var(--chart-status-4)",
};

function formatMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function formatServiceDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.getDashboardSummary().then(setData);
  }, []);

  if (!data) {
    return <div className="page">Loading…</div>;
  }

  const avgAttendance = data.attendance_trend.length
    ? Math.round(data.attendance_trend.reduce((sum, s) => sum + s.present, 0) / data.attendance_trend.length)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stat-grid">
        <StatCard label="Total members" value={data.totals.members} />
        <StatCard label="Households" value={data.totals.households} />
        <StatCard label="Ministries" value={data.totals.ministries} />
        <StatCard
          label={`Avg. attendance (last ${data.attendance_trend.length} service${data.attendance_trend.length === 1 ? "" : "s"})`}
          value={avgAttendance ?? "—"}
        />
      </div>

      <div className="dashboard-grid">
        <ChartCard
          title="Members by status"
          tableHeaders={["Status", "Members"]}
          tableRows={data.members_by_status.map((s) => [s.status, s.count])}
        >
          <BarChart
            data={data.members_by_status.map((s) => ({ label: s.status, value: s.count, color: STATUS_COLORS[s.status] }))}
          />
        </ChartCard>

        <ChartCard
          title="Members by ministry"
          tableHeaders={["Ministry", "Members"]}
          tableRows={data.members_by_ministry.map((m) => [m.name, m.count])}
        >
          <BarChart data={data.members_by_ministry.map((m) => ({ label: m.name, value: m.count }))} />
        </ChartCard>

        <ChartCard
          title="Membership growth"
          subtitle="New members by date joined, last 12 months"
          tableHeaders={["Month", "New members"]}
          tableRows={data.membership_growth.map((g) => [formatMonth(g.month), g.count])}
        >
          <LineChart
            data={data.membership_growth.map((g) => ({ x: g.month, y: g.count }))}
            formatX={formatMonth}
          />
        </ChartCard>

        <ChartCard
          title="Attendance trend"
          subtitle={`Members checked in, last ${data.attendance_trend.length} service${data.attendance_trend.length === 1 ? "" : "s"}`}
          tableHeaders={["Service date", "Type", "Present", "Total checked"]}
          tableRows={data.attendance_trend.map((s) => [formatServiceDate(s.service_date), s.service_type, s.present, s.total])}
        >
          <LineChart
            data={data.attendance_trend.map((s) => ({ x: s.service_date, y: s.present }))}
            formatX={formatServiceDate}
          />
        </ChartCard>
      </div>
    </div>
  );
}
