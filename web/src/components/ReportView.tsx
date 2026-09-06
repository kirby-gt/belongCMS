import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

interface ReportViewProps {
  title: string;
  description?: string;
  /** Filter controls, shown above the results and hidden when printing. */
  filters?: ReactNode;
  /** Called when the user clicks "Download CSV". Omit to hide the button. */
  onDownloadCsv?: () => void;
  canDownload?: boolean;
  loading?: boolean;
  error?: string;
  /** ISO timestamp from the report response, shown in the print header. */
  generatedAt?: string;
  /** Human-readable summary of the active filters, shown in the print header. */
  filterSummary?: string;
  children: ReactNode;
}

export default function ReportView({
  title,
  description,
  filters,
  onDownloadCsv,
  canDownload = true,
  loading,
  error,
  generatedAt,
  filterSummary,
  children,
}: ReportViewProps) {
  const { organization } = useAuth();

  return (
    <div className="page report-page">
      <div className="page-header no-print">
        <div>
          <Link to="/reports" className="link-btn back-link">
            ‹ All reports
          </Link>
          <h1>{title}</h1>
          {description && <p className="report-description">{description}</p>}
        </div>
        <div className="report-actions">
          {onDownloadCsv && (
            <button type="button" className="btn-secondary" onClick={onDownloadCsv} disabled={!canDownload}>
              Download CSV
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      {filters && <div className="report-filters no-print">{filters}</div>}

      <div className="report-print-header">
        <strong>{organization?.name ?? "Church"}</strong>
        <span>{title}</span>
        {filterSummary && <span>{filterSummary}</span>}
        <span>Generated {new Date(generatedAt ?? Date.now()).toLocaleString()}</span>
      </div>

      {loading ? (
        <p className="report-status">Loading…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        children
      )}
    </div>
  );
}
