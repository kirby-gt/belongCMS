import { useState, type ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  tableHeaders: string[];
  tableRows: (string | number)[][];
  children: ReactNode;
}

export default function ChartCard({ title, subtitle, tableHeaders, tableRows, children }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="chart-card-subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="link-btn chart-toggle-btn" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "View chart" : "View as table"}
        </button>
      </div>
      {showTable ? (
        <table className="data-table chart-table">
          <thead>
            <tr>
              {tableHeaders.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </div>
  );
}
