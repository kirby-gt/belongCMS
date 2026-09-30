import { Link } from "react-router-dom";

interface StatCardProps {
  label: string;
  value: string | number;
  to?: string;
}

export default function StatCard({ label, value, to }: StatCardProps) {
  const content = (
    <>
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value">{value}</p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="stat-card stat-card-link">
        {content}
      </Link>
    );
  }

  return <div className="stat-card">{content}</div>;
}
