import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api";
import { useAuth } from "../AuthContext";

interface Checkin {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  first_time: boolean | null;
  prayer_request: string | null;
  checked_in_at: string;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

export default function Visitors() {
  const { organization, refreshOrganization } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const token = organization?.public_intake_token ?? "";
  const enabled = organization?.public_intake_enabled ?? false;
  const checkinUrl = token ? `${window.location.origin}/welcome/${token}` : "";
  const orgName = organization?.name ?? "";

  const loadCheckins = useCallback(() => {
    api
      .getVisitorCheckins("new")
      .then((res) => setCheckins(res.data))
      .catch((err) => setError(err.message || "Failed to load check-ins"));
  }, []);

  useEffect(() => {
    loadCheckins();
  }, [loadCheckins]);

  useEffect(() => {
    if (!checkinUrl) return;
    QRCode.toDataURL(checkinUrl, { width: 480, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [checkinUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(checkinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the link is visible next to the button anyway */
    }
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "church"}-checkin-qr.png`;
    a.click();
  }

  function printQr() {
    if (!qrDataUrl) return;
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>${esc(orgName)} — Visitor check-in</title></head>` +
        `<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:48px">` +
        `<h2 style="margin:0 0 4px">${esc(orgName)}</h2>` +
        `<p style="margin:0 0 24px;color:#555">Scan with your phone camera to check in</p>` +
        `<img src="${qrDataUrl}" alt="QR code" style="width:340px;height:340px" />` +
        `<p style="font-size:12px;color:#777;margin-top:16px;word-break:break-all">${esc(checkinUrl)}</p>` +
        `<script>window.onload=function(){window.print()}</scr` + `ipt></body></html>`
    );
    w.document.close();
  }

  async function toggleEnabled() {
    setError("");
    try {
      await api.setIntakeEnabled(!enabled);
      await refreshOrganization();
    } catch (err: any) {
      setError(err.message || "Failed to update setting");
    }
  }

  async function rotate() {
    if (!confirm("Regenerate the link? Any QR codes or links you've already printed or shared will stop working.")) {
      return;
    }
    setError("");
    try {
      await api.rotateIntakeToken();
      await refreshOrganization();
    } catch (err: any) {
      setError(err.message || "Failed to regenerate link");
    }
  }

  async function convert(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api.convertVisitorCheckin(id);
      setCheckins((cs) => cs.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to add member");
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api.dismissVisitorCheckin(id);
      setCheckins((cs) => cs.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to dismiss");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Visitors</h1>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="qr-panel">
        {qrDataUrl ? <img src={qrDataUrl} alt="Visitor check-in QR code" className="qr-code" /> : null}
        <div className="qr-panel-body">
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Visitor check-in code</h2>
          <p className="subtitle" style={{ margin: 0 }}>
            Print this and place it at the welcome desk. Visitors scan it, fill in their details, and appear in the
            list below with the date and time they checked in.
          </p>

          <div className="qr-link-row">
            <code>{checkinUrl}</code>
            <button type="button" className="link-btn" onClick={copyLink}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="qr-actions">
            <button type="button" onClick={downloadQr} disabled={!qrDataUrl}>
              Download PNG
            </button>
            <button type="button" onClick={printQr} disabled={!qrDataUrl}>
              Print
            </button>
            <button type="button" onClick={toggleEnabled}>
              {enabled ? "Turn intake off" : "Turn intake on"}
            </button>
            <button type="button" className="danger" onClick={rotate}>
              Regenerate link
            </button>
          </div>

          {!enabled && (
            <p className="subtitle" style={{ margin: "12px 0 0", color: "var(--danger)" }}>
              Intake is off — the form won't accept submissions until you turn it back on.
            </p>
          )}
        </div>
      </div>

      <div className="page-header">
        <h2 style={{ fontSize: 16, margin: 0 }}>
          Pending check-ins{checkins.length ? ` (${checkins.length})` : ""}
        </h2>
      </div>

      {checkins.length === 0 ? (
        <div className="checkin-empty">No visitor check-ins waiting for review.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>First time?</th>
                <th>Prayer request</th>
                <th>Checked in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {checkins.map((c) => (
                <tr key={c.id}>
                  <td>{c.full_name}</td>
                  <td>
                    {c.phone || c.email ? (
                      <>
                        {c.phone && <div>{c.phone}</div>}
                        {c.email && <div>{c.email}</div>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{c.first_time == null ? "—" : c.first_time ? "Yes" : "No"}</td>
                  <td style={{ maxWidth: 260, whiteSpace: "normal" }}>{c.prayer_request || "—"}</td>
                  <td>{new Date(c.checked_in_at).toLocaleString()}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={busyId === c.id}
                        onClick={() => convert(c.id)}
                      >
                        Add as member
                      </button>
                      <button type="button" disabled={busyId === c.id} onClick={() => dismiss(c.id)}>
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
