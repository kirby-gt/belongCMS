import { useState } from "react";
import Papa from "papaparse";
import { api } from "../api";

const EXPECTED_COLUMNS = [
  "full_name",
  "date_of_birth",
  "gender",
  "marital_status",
  "phone",
  "email",
  "address",
  "membership_status",
  "date_joined",
  "baptism_date",
  "occupation",
  "emergency_contact_name",
  "emergency_contact_phone",
  "household_name",
  "ministries",
];

const CANONICAL_KEYS = new Set(EXPECTED_COLUMNS);

// Common human-readable column headings (e.g. from a spreadsheet export) mapped to the
// canonical field names the import endpoint expects. Keyed by lowercased, whitespace-collapsed header text.
const HEADER_ALIASES: Record<string, string> = {
  "name": "full_name",
  "full name": "full_name",
  "member name": "full_name",
  "date of birth": "date_of_birth",
  "dob": "date_of_birth",
  "birth date": "date_of_birth",
  "birthday": "date_of_birth",
  "sex": "gender",
  "marital status": "marital_status",
  "phone number": "phone",
  "mobile": "phone",
  "contact number": "phone",
  "email address": "email",
  "home address": "address",
  "status": "membership_status",
  "membership status": "membership_status",
  "member status": "membership_status",
  "date joined": "date_joined",
  "join date": "date_joined",
  "joined": "date_joined",
  "baptism date": "baptism_date",
  "date baptized": "baptism_date",
  "baptized": "baptism_date",
  "job": "occupation",
  "profession": "occupation",
  "emergency contact name": "emergency_contact_name",
  "emergency contact": "emergency_contact_name",
  "emergency contact phone": "emergency_contact_phone",
  "emergency phone": "emergency_contact_phone",
  "household": "household_name",
  "household name": "household_name",
  "family": "household_name",
  "ministries / departments": "ministries",
  "ministries/departments": "ministries",
  "departments": "ministries",
  "ministry": "ministries",
};

function normalizeHeader(header: string): string {
  const cleaned = header.trim().toLowerCase().replace(/\s+/g, " ");
  if (HEADER_ALIASES[cleaned]) return HEADER_ALIASES[cleaned];
  const snakeCased = cleaned.replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
  return CANONICAL_KEYS.has(snakeCased) ? snakeCased : header;
}

function normalizeRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    out[normalizeHeader(key)] = value;
  }
  return out;
}

export default function ImportMembers() {
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ created: number; error_count: number; results: any[] } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setResults(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length) {
          setError(res.errors[0].message);
          return;
        }
        setRows((res.data as Record<string, any>[]).map(normalizeRow));
      },
    });
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      const res = await api.importMembers(rows);
      setResults(res);
    } catch (err: any) {
      setError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = EXPECTED_COLUMNS.join(",") + "\n" +
      "Sharon Adams,1985-04-12,Female,Married,5926000000,,Lot 12 Sheriff St Georgetown,Member,2020-01-15,2020-06-01,Teacher,John Adams,5926000001,Adams family,\"Choir,Sunday school\"\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "member_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Import members</h1>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 16 }}>
        Upload a CSV of members you've digitized from paper records. Household and ministry names are matched or
        created automatically — no need to set those up first.
      </p>

      <button className="link-btn" style={{ marginBottom: 16 }} onClick={downloadTemplate}>
        Download CSV template
      </button>

      {error && <p className="error">{error}</p>}

      <div className="file-drop">
        <span className="file-drop-icon">⇪</span>
        <div style={{ flex: 1 }}>
          <input type="file" accept=".csv" onChange={handleFile} />
          <div className="file-drop-text">CSV files only. Rows are previewed before anything is saved.</div>
        </div>
      </div>

      {rows.length > 0 && !results && (
        <>
          <p style={{ fontSize: 14, marginBottom: 8 }}>
            {fileName}: {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
          </p>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Household</th>
                  <th>Ministries</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    <td>{r.full_name}</td>
                    <td>{r.membership_status || "Visitor"}</td>
                    <td>{r.household_name || "—"}</td>
                    <td>{r.ministries || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -8, marginBottom: 16 }}>
              …and {rows.length - 5} more
            </p>
          )}
          <button className="btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? "Importing…" : `Import ${rows.length} members`}
          </button>
        </>
      )}

      {results && (
        <div>
          <p style={{ fontSize: 15, marginBottom: 12 }}>
            <strong>{results.created}</strong> member{results.created === 1 ? "" : "s"} imported
            {results.error_count > 0 && <span style={{ color: "var(--danger)" }}> — {results.error_count} row(s) failed</span>}
            .
          </p>
          {results.error_count > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results
                    .filter((r) => r.status === "error")
                    .map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.name || "—"}</td>
                        <td>{r.message}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
