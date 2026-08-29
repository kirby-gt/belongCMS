import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan_status: "trialing" | "active" | "pending_review" | "canceled";
  trial_ends_at: string;
  current_period_end: string | null;
  payment_reference: string | null;
  payment_submitted_at: string | null;
  subscribed_at: string | null;
  created_at: string;
  member_count: number;
  user_count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Compact renewal state for the admin table.
function renewalCell(o: AdminOrg): { text: string; tone: "" | "warn" | "bad" } {
  if (o.plan_status !== "active" && o.plan_status !== "pending_review") return { text: "—", tone: "" };
  if (!o.current_period_end) return { text: "—", tone: "" };
  const days = Math.ceil((new Date(o.current_period_end).getTime() - Date.now()) / DAY_MS);
  const date = new Date(o.current_period_end).toLocaleDateString();
  if (days > 5) return { text: date, tone: "" };
  if (days > 0) return { text: `${date} · due in ${days}d`, tone: "warn" };
  if (days > -5) return { text: `${date} · grace, ${5 + days}d left`, tone: "bad" };
  return { text: `${date} · lapsed`, tone: "bad" };
}

const STATUS_LABEL: Record<string, string> = {
  "": "All",
  pending_review: "Pending review",
  trialing: "Trialing",
  active: "Active",
  canceled: "Canceled",
};

const FILTERS = ["", "pending_review", "trialing", "active", "canceled"];

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString() : "—";
}

export default function Admin() {
  const [filter, setFilter] = useState("");
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .getAdminOrganizations(filter)
      .then((res) => {
        setOrgs(res.data);
        setCounts(res.counts);
      })
      .catch((err) => setError(err.message || "Failed to load organizations"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch after a mutation so both the rows and the filter counts stay right
  // (and a row that no longer matches the active filter drops out).
  async function run(id: string, fn: () => Promise<AdminOrg>) {
    setBusyId(id);
    setError("");
    try {
      await fn();
      load();
    } catch (err: any) {
      setError(err.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function activate(o: AdminOrg) {
    const raw = window.prompt(`Verify payment for ${o.name} — how many months does it cover?`, "1");
    if (raw == null) return;
    const months = Number(raw);
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      setError("Enter a whole number of months between 1 and 24.");
      return;
    }
    run(o.id, () => api.activateOrg(o.id, months));
  }

  function extend(o: AdminOrg) {
    const raw = window.prompt(`Extend ${o.name}'s trial by how many days?`, "14");
    if (raw == null) return;
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      setError("Enter a whole number of days between 1 and 90.");
      return;
    }
    run(o.id, () => api.extendOrgTrial(o.id, days));
  }

  function cancel(o: AdminOrg) {
    if (!window.confirm(`Cancel ${o.name}? They'll lose access at the next page load.`)) return;
    run(o.id, () => api.cancelOrg(o.id));
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin — subscriptions</h1>
        <button type="button" className="link-btn" onClick={load}>
          Refresh
        </button>
      </div>

      <div className="admin-filters">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            type="button"
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {STATUS_LABEL[f]}
            {counts[f] != null ? ` (${counts[f]})` : ""}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : orgs.length === 0 ? (
        <div className="checkin-empty">No organizations{filter ? ` with status “${STATUS_LABEL[filter]}”` : ""}.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Church</th>
                <th>Status</th>
                <th>Trial ends</th>
                <th>Renewal</th>
                <th>Payment ref</th>
                <th>Members</th>
                <th>Signed up</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => {
                const trialExpired =
                  o.plan_status === "trialing" && new Date(o.trial_ends_at) < new Date();
                return (
                  <tr key={o.id}>
                    <td>
                      <div>{o.name}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{o.slug}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${o.plan_status.replace("_", "-")}`}>
                        {STATUS_LABEL[o.plan_status] || o.plan_status}
                      </span>
                      {trialExpired && (
                        <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>expired</div>
                      )}
                    </td>
                    <td>{o.plan_status === "trialing" ? fmtDate(o.trial_ends_at) : "—"}</td>
                    <td>
                      {(() => {
                        const r = renewalCell(o);
                        const color =
                          r.tone === "bad" ? "var(--danger)" : r.tone === "warn" ? "#b45309" : undefined;
                        return <span style={{ color, fontSize: 13 }}>{r.text}</span>;
                      })()}
                    </td>
                    <td>
                      {o.payment_reference ? (
                        <>
                          <div>{o.payment_reference}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                            {fmtDate(o.payment_submitted_at)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{o.member_count}</td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="primary"
                          disabled={busyId === o.id}
                          onClick={() => activate(o)}
                        >
                          Verify payment
                        </button>
                        <button type="button" disabled={busyId === o.id} onClick={() => extend(o)}>
                          Extend trial
                        </button>
                        {o.plan_status !== "canceled" && (
                          <button type="button" disabled={busyId === o.id} onClick={() => cancel(o)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
