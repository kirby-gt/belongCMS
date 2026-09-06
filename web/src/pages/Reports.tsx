import { Link } from "react-router-dom";

const REPORTS = [
  {
    to: "/reports/attendance",
    title: "Attendance summary",
    description: "Totals and averages by service type over a date range, compared with the previous period.",
  },
  {
    to: "/reports/absentees",
    title: "Absentee / at-risk list",
    description: "Members who used to attend regularly but haven't been recorded present in the last few weeks.",
  },
  {
    to: "/reports/directory",
    title: "Member directory",
    description: "The full membership list with households and ministries. Download as CSV or print.",
  },
  {
    to: "/reports/milestones",
    title: "Birthdays & anniversaries",
    description: "Birthdays, baptism anniversaries and membership anniversaries falling in a chosen month.",
  },
  {
    to: "/reports/ministries",
    title: "Ministry roster",
    description: "Members in each ministry with their contact details — one ministry or all of them.",
  },
];

export default function Reports() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
      </div>
      <p className="report-description">
        Pick a report, adjust the filters, then download it as CSV or use Print to save a PDF.
      </p>
      <div className="report-menu">
        {REPORTS.map((r) => (
          <Link key={r.to} to={r.to} className="report-menu-item">
            <span className="report-menu-title">{r.title}</span>
            <span className="report-menu-desc">{r.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
